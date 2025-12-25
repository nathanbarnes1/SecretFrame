import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { ethers } from "ethers";

const IV_LENGTH = 12;

function deriveKey(addressKey: string): Buffer {
  return createHash("sha256").update(addressKey.toLowerCase()).digest();
}

function encryptUrl(url: string, addressKey: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(addressKey);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

function decryptUrl(payload: string, addressKey: string): string {
  const data = Buffer.from(payload, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(IV_LENGTH, data.length - 16);
  const key = deriveKey(addressKey);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

task("task:address", "Prints the SecretFrame address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const deployment = await deployments.get("SecretFrame");
  console.log("SecretFrame address is " + deployment.address);
});

task("task:mint-frame", "Mint a new SecretFrame with an encrypted URL")
  .addParam("url", "The URL to encrypt and store")
  .addOptionalParam("address", "Override SecretFrame contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers: hardhatEthers, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SecretFrame");
    const signer = (await hardhatEthers.getSigners())[0];
    const secretWallet = ethers.Wallet.createRandom();

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .addAddress(secretWallet.address)
      .encrypt();

    const encryptedUrl = encryptUrl(taskArguments.url, secretWallet.address);

    const secretFrame = await hardhatEthers.getContractAt("SecretFrame", deployment.address);
    const tx = await secretFrame
      .connect(signer)
      .mintFrame(encryptedUrl, encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Submitted mint tx ${tx.hash}`);
    await tx.wait();
    console.log(`Minted with viewer key ${secretWallet.address}`);
  });

task("task:decrypt-frame", "Decrypt a stored frame for the caller")
  .addParam("tokenid", "Token id to decrypt")
  .addOptionalParam("address", "Override SecretFrame contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers: hardhatEthers, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const tokenId = parseInt(taskArguments.tokenid);
    if (!Number.isInteger(tokenId)) {
      throw new Error("tokenid must be an integer");
    }

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("SecretFrame");
    const signer = (await hardhatEthers.getSigners())[0];
    const secretFrame = await hardhatEthers.getContractAt("SecretFrame", deployment.address);
    const frame = await secretFrame.getFrame(tokenId);

    const decryptedKey = await fhevm.userDecryptEaddress(
      FhevmType.eaddress,
      frame[1],
      deployment.address,
      signer,
    );
    const decryptedUrl = decryptUrl(frame[0], decryptedKey);
    console.log(`Token ${tokenId} owner key: ${decryptedKey}`);
    console.log(`Decrypted URL: ${decryptedUrl}`);
  });

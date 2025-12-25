import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { SecretFrame, SecretFrame__factory } from "../types";

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

describe("SecretFrame", function () {
  let owner: HardhatEthersSigner;
  let viewer: HardhatEthersSigner;
  let contract: SecretFrame;
  let contractAddress: string;

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    [owner, viewer] = await ethers.getSigners();
    const factory = (await ethers.getContractFactory("SecretFrame")) as SecretFrame__factory;
    contract = (await factory.deploy()) as SecretFrame;
    contractAddress = await contract.getAddress();
  });

  it("stores encrypted payloads and lets the owner decrypt the URL", async function () {
    const urlToProtect = "https://secret.frame/example/image.png";
    const encryptionWallet = ethers.Wallet.createRandom();
    const encryptedUrl = encryptUrl(urlToProtect, encryptionWallet.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, owner.address)
      .addAddress(encryptionWallet.address)
      .encrypt();

    const predictedId = await contract.mintFrame.staticCall(
      encryptedUrl,
      encryptedInput.handles[0],
      encryptedInput.inputProof,
    );
    const tx = await contract.mintFrame(encryptedUrl, encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const tokens = await contract.tokensOf(owner.address);
    expect(tokens.map((id: bigint) => Number(id))).to.deep.eq([Number(predictedId)]);

    const frame = await contract.getFrame(Number(predictedId));
    expect(frame[0]).to.eq(encryptedUrl);
    const encryptedHandle = typeof frame[1] === "string" ? (frame[1] as string) : ethers.hexlify(frame[1]);
    const decryptedAddress = await fhevm.userDecryptEaddress(encryptedHandle, contractAddress, owner);
    expect(decryptedAddress.toLowerCase()).to.eq(encryptionWallet.address.toLowerCase());

    const revealedUrl = decryptUrl(frame[0], decryptedAddress);
    expect(revealedUrl).to.eq(urlToProtect);
  });

  it("blocks transfers to keep the NFT soulbound", async function () {
    const urlToProtect = "https://secret.frame/one";
    const encryptionWallet = ethers.Wallet.createRandom();
    const encryptedUrl = encryptUrl(urlToProtect, encryptionWallet.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, owner.address)
      .addAddress(encryptionWallet.address)
      .encrypt();
    await contract.mintFrame(encryptedUrl, encryptedInput.handles[0], encryptedInput.inputProof);

    await expect(
      contract.transferFrom(owner.address, viewer.address, 1),
    ).to.be.revertedWithCustomError(contract, "TransferDisabled");
  });
});

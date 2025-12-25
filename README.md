# SecretFrame

SecretFrame is a privacy-first NFT project that mints soulbound ERC721 tokens whose destinations remain hidden. Each NFT
stores an encrypted URL and an encrypted viewer key, so only the owner can decrypt and reveal the URL later.

## Overview

SecretFrame solves a simple but common problem: public NFTs expose all metadata, including private links. This project
keeps the destination private while still proving ownership on-chain. It uses Zama FHE to encrypt the viewer key on the
contract, and AES-GCM to encrypt the URL off-chain.

## Problems Solved

- Public NFT metadata leaks private or gated content URLs.
- Off-chain secrets are easy to lose or share accidentally.
- Owners need a way to prove possession while keeping links private.
- Creators want soulbound NFTs that cannot be transferred.

## Advantages

- Privacy by default: URLs are never stored in plaintext on-chain.
- Owner-only decryption: the viewer key is encrypted using FHE and tied to the owner.
- Soulbound: transfer and approval methods are disabled.
- Simple UX: mint with one URL and decrypt on demand.
- No frontend secrets: the UI does not rely on env vars or local storage.

## How It Works

1. A user enters a URL in the frontend.
2. The frontend generates a random address key.
3. The URL is encrypted with AES-GCM using the address key.
4. The address key is encrypted with Zama FHE and sent to the contract.
5. The contract stores the encrypted URL + encrypted viewer key.
6. When the owner wants to decrypt, the Zama relayer returns the decrypted address key.
7. The frontend uses the key to decrypt the URL locally.

### URL Encryption Format

- The encrypted URL is stored as base64 of: `iv (12 bytes) + ciphertext + authTag (16 bytes)`.
- AES-GCM is used so any tampering fails decryption.

## Tech Stack

- Smart contracts: Solidity 0.8.x, Hardhat, hardhat-deploy
- FHE: Zama FHEVM (`@fhevm/solidity`) and relayer SDK
- Frontend: React + Vite, RainbowKit, Wagmi, viem (reads), ethers (writes)
- Testing: Hardhat, Chai, Mocha

## Architecture Notes

- `SecretFrame.sol` is a soulbound ERC721-like contract with custom storage.
- Encrypted URL is stored as a base64 string.
- Encrypted viewer key is stored as `eaddress` (Zama FHE handle).
- No transfer or approval flow is enabled, by design.

## Project Structure

```
.
├── contracts/                 # Solidity contracts
├── deploy/                    # Hardhat deploy scripts
├── deployments/               # Deployed artifacts (ABI lives here)
├── tasks/                     # Hardhat tasks (mint/decrypt helpers)
├── test/                      # Contract tests
├── frontend/                  # React + Vite frontend
└── hardhat.config.ts
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Sepolia-funded wallet for deployment and testing

### Install Dependencies

```bash
npm install
```

Frontend dependencies:

```bash
cd frontend
npm install
```

### Environment Setup

Create a `.env` in the repo root (do not use MNEMONIC):

```
PRIVATE_KEY=your_private_key_without_0x
INFURA_API_KEY=your_infura_api_key
ETHERSCAN_API_KEY=optional_for_verify
```

### Compile and Test

```bash
npm run compile
npm run test
```

### Deploy to Sepolia

```bash
npm run deploy:sepolia
```

### Verify (Optional)

```bash
npm run verify:sepolia -- <CONTRACT_ADDRESS>
```

## Frontend Setup

1. Copy the ABI from `deployments/sepolia/SecretFrame.json` into
   `frontend/src/config/contracts.ts`.
2. Set `CONTRACT_ADDRESS` in `frontend/src/config/contracts.ts` to your deployed address.
3. The frontend is configured for Sepolia only (no localhost networks).
4. Run the frontend:

```bash
cd frontend
npm run dev
```

The UI reads with viem and writes with ethers, as required.

## Frontend Usage

### Mint Flow

1. Connect a wallet on Sepolia.
2. Enter the URL you want to hide.
3. Confirm the transaction in your wallet.
4. Save the viewer address key shown after minting (this is not stored in the UI).

### Decrypt Flow

1. Open the gallery section after connecting your wallet.
2. Click "Decrypt URL" on a frame you own.
3. Approve the EIP-712 signature request in your wallet.
4. The decrypted URL appears in the card and can be opened.

## Hardhat Tasks

Print contract address:

```bash
npx hardhat task:address --network sepolia
```

Mint a frame:

```bash
npx hardhat task:mint-frame --network sepolia --url "https://example.com/secret"
```

Decrypt a frame:

```bash
npx hardhat task:decrypt-frame --network sepolia --tokenid 1
```

## Security and Privacy Notes

- URLs are encrypted client-side with AES-GCM.
- The encryption key is an address encrypted with Zama FHE.
- Only the owner can request decryption via the relayer flow.
- The frontend does not use local storage for secrets.

## Known Limitations

- Soulbound by design: tokens cannot be transferred.
- Decryption requires Zama relayer availability.
- URLs are only as private as the user's device and wallet security.

## Future Plans

- Token metadata display without revealing the URL.
- Batch minting and gallery pagination.
- Optional URL rotation with re-encryption.
- Improved relayer error handling and retries.
- Better on-chain event indexing for faster loading.
- UI theming and accessibility improvements.

## License

BSD-3-Clause-Clear. See `LICENSE`.

import { type FormEvent, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract, Wallet } from 'ethers';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ABI, CONTRACT_ADDRESS, CONTRACT_READY } from '../config/contracts';
import { encryptUrlWithKey, normalizeAddressKey } from '../lib/encryption';
import '../styles/MintFrame.css';

type MintFrameProps = {
  onMinted?: () => void;
};

export function MintFrame({ onMinted }: MintFrameProps) {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [url, setUrl] = useState('');
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const disabledReason = useMemo(() => {
    if (!CONTRACT_READY) return 'Deploy to Sepolia and set the contract address';
    if (!isConnected) return 'Connect a wallet to mint';
    if (zamaLoading) return 'Preparing Zama relayer';
    if (!instance) return 'Encryption service unavailable';
    return '';
  }, [isConnected, zamaLoading, instance]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!instance || !address || !signerPromise || !CONTRACT_READY) {
      setStatusMessage('Missing wallet or encryption instance');
      return;
    }
    if (!url) {
      setStatusMessage('Please provide a URL to lock behind the NFT');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('Encrypting URL and registering inputs...');

    try {
      const signer = await signerPromise;
      const viewerWallet = Wallet.createRandom();
      const normalizedKey = normalizeAddressKey(viewerWallet.address);
      const encryptedUrl = await encryptUrlWithKey(url, normalizedKey);

      const encryptedInput = await instance.createEncryptedInput(CONTRACT_ADDRESS, address).addAddress(normalizedKey).encrypt();

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.mintFrame(encryptedUrl, encryptedInput.handles[0], encryptedInput.inputProof);

      setStatusMessage('Waiting for confirmation...');
      await tx.wait();
      setStatusMessage('Minted and stored on-chain');
      setEncryptionKey(normalizedKey);
      setUrl('');
      onMinted?.();
    } catch (err: any) {
      console.error(err);
      setStatusMessage(err?.message || 'Failed to mint');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mint-card">
      <div className="mint-header">
        <div>
          <p className="eyebrow">Mint</p>
          <h3>Encrypt a new frame</h3>
        </div>
        <span className="badge">Ethers write</span>
      </div>

      <form className="mint-form" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="url">
          Target URL
        </label>
        <input
          id="url"
          type="url"
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="text-field"
          autoComplete="off"
        />
        <p className="help">
          The URL is symmetrically encrypted with a fresh address key. The key itself is encrypted through Zama FHE and
          stored with the NFT.
        </p>

        <button type="submit" className="primary" disabled={!!disabledReason || isSubmitting}>
          {isSubmitting ? 'Submitting...' : disabledReason || 'Mint encrypted NFT'}
        </button>
      </form>

      <div className="status">
        {!CONTRACT_READY ? <p className="error">Set CONTRACT_ADDRESS to your deployed Sepolia SecretFrame address.</p> : null}
        {zamaError ? <p className="error">Relayer error: {zamaError}</p> : null}
        {statusMessage ? <p className="muted">{statusMessage}</p> : null}
        {encryptionKey ? (
          <div className="key-box">
            <p className="key-label">Viewer address key</p>
            <code className="key-value">{encryptionKey}</code>
            <p className="key-hint">
              This address is already encrypted on-chain. You can decrypt it later via the gallery to reveal the URL again.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

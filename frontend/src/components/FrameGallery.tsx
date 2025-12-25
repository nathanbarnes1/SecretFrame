import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { CONTRACT_ABI, CONTRACT_ADDRESS, CONTRACT_READY } from '../config/contracts';
import { decryptUrlWithKey, normalizeAddressKey } from '../lib/encryption';
import '../styles/FrameGallery.css';

type FrameView = {
  tokenId: bigint;
  encryptedUrl: string;
  encryptedViewerKey: string;
  mintedAt: bigint;
  revealedUrl?: string;
  viewerKey?: string;
};

type FrameGalleryProps = {
  ownerAddress?: `0x${string}`;
  refreshKey: number;
  isConnected: boolean;
};

export function FrameGallery({ ownerAddress, refreshKey, isConnected }: FrameGalleryProps) {
  const publicClient = usePublicClient();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const { address } = useAccount();

  const [frames, setFrames] = useState<FrameView[]>([]);
  const [loading, setLoading] = useState(false);
  const [decryptingId, setDecryptingId] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const heading = useMemo(() => {
    if (!CONTRACT_READY) return 'Deploy SecretFrame to Sepolia and set the contract address to continue.';
    if (!isConnected) return 'Connect your wallet to view your encrypted frames.';
    if (loading) return 'Fetching your NFTs...';
    if (frames.length === 0) return 'No encrypted NFTs yet. Mint one to get started.';
    return '';
  }, [isConnected, frames.length, loading]);

  const loadFrames = useCallback(async () => {
    if (!CONTRACT_READY) {
      setFrames([]);
      setError('Contract address is not set for Sepolia deployment.');
      setLoading(false);
      return;
    }
    if (!ownerAddress || !publicClient) {
      setFrames([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tokenIds = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'tokensOf',
        args: [ownerAddress],
      })) as bigint[];

      const detailed = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const frame = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: 'getFrame',
            args: [tokenId],
          });
          return {
            tokenId,
            encryptedUrl: frame[0] as string,
            encryptedViewerKey: frame[1] as string,
            mintedAt: frame[2] as bigint,
          };
        }),
      );

      setFrames(detailed);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load frames');
    } finally {
      setLoading(false);
    }
  }, [ownerAddress, publicClient]);

  useEffect(() => {
    loadFrames();
  }, [loadFrames, refreshKey]);

  const decryptFrame = async (frame: FrameView) => {
    if (!instance || !address || !signerPromise || !CONTRACT_READY) {
      setError('Wallet and Zama relayer must be ready to decrypt.');
      return;
    }

    setDecryptingId(frame.tokenId);
    setError(null);
    try {
      const signer = await signerPromise;
      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        {
          handle: frame.encryptedViewerKey,
          contractAddress: CONTRACT_ADDRESS,
        },
      ];
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [CONTRACT_ADDRESS];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const decryptedKey = result[frame.encryptedViewerKey] || result[frame.encryptedViewerKey.toLowerCase()];
      if (!decryptedKey) {
        throw new Error('Could not decrypt viewer key');
      }
      const normalizedKey = normalizeAddressKey(decryptedKey);
      const url = await decryptUrlWithKey(frame.encryptedUrl, normalizedKey);

      setFrames((prev) =>
        prev.map((item) =>
          item.tokenId === frame.tokenId ? { ...item, revealedUrl: url, viewerKey: normalizedKey } : item,
        ),
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to decrypt frame');
    } finally {
      setDecryptingId(null);
    }
  };

  return (
    <div className="frame-grid">
      {heading ? <p className="grid-hint">{heading}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="grid">
        {frames.map((frame) => (
          <article className="frame-card" key={frame.tokenId.toString()}>
            <div className="frame-top">
              <div>
                <p className="eyebrow">Token #{frame.tokenId.toString()}</p>
                <h4>Encrypted destination</h4>
              </div>
              <span className="timestamp">{new Date(Number(frame.mintedAt) * 1000).toLocaleString()}</span>
            </div>

            <p className="cipher">Ciphertext: {frame.encryptedUrl.slice(0, 42)}...</p>
            <p className="cipher">Encrypted key handle: {frame.encryptedViewerKey.slice(0, 18)}...</p>

            {frame.revealedUrl ? (
              <div className="reveal-box">
                <p className="eyebrow">Decrypted URL</p>
                <a href={frame.revealedUrl} target="_blank" rel="noreferrer" className="url">
                  {frame.revealedUrl}
                </a>
                {frame.viewerKey ? <p className="key">Viewer key: {frame.viewerKey}</p> : null}
              </div>
            ) : (
              <button
                className="secondary"
                onClick={() => decryptFrame(frame)}
                disabled={decryptingId === frame.tokenId || !instance || !isConnected}
              >
                {decryptingId === frame.tokenId ? 'Decrypting...' : 'Decrypt URL'}
              </button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from './Header';
import { MintFrame } from './MintFrame';
import { FrameGallery } from './FrameGallery';
import '../styles/SecretFrameApp.css';

export function SecretFrameApp() {
  const { address, isConnected } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMinted = () => setRefreshKey(key => key + 1);

  return (
    <div className="app-shell">
      <Header />

      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Encrypted NFT vault</p>
          <h1>Mint NFTs with hidden destinations</h1>
          <p className="lede">
            SecretFrame locks each NFT behind an encrypted URL and a fully homomorphic access key. Only the holder can
            decrypt the destination—no plain text leaks, no off-chain secrets exposed.
          </p>
          <div className="hero-highlights">
            <div>
              <span className="stat-label">Zama FHE secured</span>
              <span className="stat-value">Address key remains encrypted on-chain</span>
            </div>
            <div>
              <span className="stat-label">Soulbound</span>
              <span className="stat-value">Tokens stay with the minter</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <MintFrame onMinted={handleMinted} />
        </div>
      </section>

      <section className="gallery-section">
        <div className="section-header">
          <div>
            <p className="eyebrow">Your encrypted frames</p>
            <h2>Decrypt URLs only you can unlock</h2>
          </div>
          <p className="section-note">
            Frames are bound to the minter. Each one stores a ciphered URL plus an FHE-encrypted address key that you can
            re-encrypt locally through the Zama relayer.
          </p>
        </div>
        <FrameGallery ownerAddress={address} refreshKey={refreshKey} isConnected={isConnected} />
      </section>
    </div>
  );
}

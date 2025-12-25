import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="brand">
            <div className="mark">SF</div>
            <div>
              <h1 className="title">SecretFrame</h1>
              <p className="subtitle">Encrypted URLs, soulbound NFTs</p>
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'SecretFrame',
  projectId: 'b2d0b2b8c6b54e8fa3ad1b1fbcbe8b70',
  chains: [sepolia],
  ssr: false,
});

import { defineChain, parseAbi } from 'viem';

export const giwaSepolia = defineChain({
  id: 91342,
  name: 'GIWA Sepolia',
  nativeCurrency: { name: 'Test Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia-rpc.giwa.io'] } },
  blockExplorers: { default: { name: 'GIWA Explorer', url: 'https://sepolia-explorer.giwa.io' } },
  testnet: true,
});

export const dojang = {
  scroll: '0xd5077b67dcb56cac8b270c7788fc3e6ee03f17b9',
  eas: '0x4200000000000000000000000000000000000021',
  faucetAttester: '0xaa92f8c143657dde575de430aecaea6ca91f2e6072339b16932d426895d8d678',
  upbitAttester: '0xd99b42e778498aa3c9c1f6a012359130252780511687a35982e8e52735453034',
} as const;

export const dojangScrollAbi = parseAbi([
  'function isVerified(address account, bytes32 attesterId) view returns (bool)',
  'function getVerifiedAddressAttestationUid(address account, bytes32 attesterId) view returns (bytes32)',
]);

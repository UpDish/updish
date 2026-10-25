'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { giwaSepolia } from '../../../packages/chain-config/giwa';

export function Providers({ children }: { children: React.ReactNode }) {
  const [config] = useState(() => createConfig({
    chains: [giwaSepolia], connectors: [injected()], ssr: true,
    transports: { [giwaSepolia.id]: http() },
  }));
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));
  return <WagmiProvider config={config}><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></WagmiProvider>;
}

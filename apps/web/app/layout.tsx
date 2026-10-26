import type { Metadata } from 'next';
import './globals.css';
import './exchange.css';
import './journey.css';
import './tasks.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'UpDish | 음식점 매출과 모의 정산',
  description: '매출 근거부터 모의 청약·보유·정산까지, GIWA와 Dojang으로 확인하는 해커톤 데모.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><Providers>{children}</Providers></body></html>;
}

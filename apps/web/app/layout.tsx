import type { Metadata } from 'next';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';
import './globals.css';
import './exchange.css';
import './journey.css';
import './tasks.css';
import './presentation.css';
import './upbit-ui.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'UpDish | 가게의 확장에 참여하는 매출 연동 투자',
  description: '가게 탐색, 모의 청약, 보유와 테스트 자산 분배. 업비트 서비스 확장을 제안하는 GIWA 해커톤 DEMO.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><Providers>{children}</Providers></body></html>;
}

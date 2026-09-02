import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: '600',
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Career Atelier — AI 채용 작전선',
  description: '개인 Codex와 Claude Code 에이전트가 기업 조사부터 자기소개서 작성과 검수까지 협업하는 우주선 콘셉트의 커리어 OS',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className={spaceGrotesk.variable}>{children}</body>
    </html>
  );
}

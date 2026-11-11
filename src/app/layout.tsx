import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import RecoilProvider from '@/components/providers/RecoilProvider';
import AuthProvider from '@/components/auth/AuthProvider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'GospelFix Admin',
  description: 'GospelFix 관리자 페이지',
  manifest: '/manifest.webmanifest',
  icons: { apple: '/icons/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'GF Admin', statusBarStyle: 'default' },
};

// 화면 끝까지 확장해야 env(safe-area-inset-*)가 동작한다(아이폰 홈 인디케이터 영역 대응).
export const viewport: Viewport = { viewportFit: 'cover' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <RecoilProvider>
            <AuthProvider>{children}</AuthProvider>
            <Toaster />
          </RecoilProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

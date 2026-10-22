import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import RecoilProvider from '@/components/providers/RecoilProvider';
import AuthProvider from '@/components/auth/AuthProvider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'GospelFix Admin',
  description: 'GospelFix 관리자 페이지',
};

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

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletContextProvider } from '@/components/WalletContextProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Hastrology - AI-Powered Horoscopes on Solana',
  description: 'Discover your cosmic path with AI-generated horoscopes. Pay with Solana, share on X, and enter daily lottery.',
  keywords: ['horoscope', 'astrology', 'solana', 'crypto', 'AI', 'web3'],
  authors: [{ name: 'Hastrology' }],
  openGraph: {
    title: 'Hastrology - Your Cosmic Path On-Chain',
    description: 'AI-Powered Horoscopes on Solana',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hastrology',
    description: 'AI-Powered Horoscopes on Solana',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-slate-900`}>
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </body>
    </html>
  );
}

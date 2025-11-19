'use client';

import { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Hero } from '@/components/Hero';
import { BirthDetailsForm } from '@/components/BirthDetailsForm';
import { HoroscopeSection } from '@/components/HoroscopeSection';
import { useStore } from '@/store/useStore';

export default function Home() {
  const { publicKey, connected } = useWallet();
  const { setWallet, reset } = useStore();

  useEffect(() => {
    if (connected && publicKey) {
      setWallet(publicKey.toBase58());
    } else {
      reset();
    }
  }, [connected, publicKey]);

  return (
    <main className="relative">
      {/* Hero Section */}
      <Hero />

      {/* Birth Details Form - only show when wallet connected */}
      {connected && <BirthDetailsForm />}

      {/* Horoscope Section - shows payment and generation */}
      {connected && <HoroscopeSection />}

      {/* Footer */}
      <footer className="py-8 px-4 bg-slate-950 text-center text-gray-500 text-sm">
        <p>© 2024 Hastrology. Your cosmic journey on Solana.</p>
        <p className="mt-2">
          <a href="#" className="hover:text-purple-400 transition-colors">FAQ</a>
          {' · '}
          <a href="#" className="hover:text-purple-400 transition-colors">About</a>
          {' · '}
          <a href="#" className="hover:text-purple-400 transition-colors">Support</a>
        </p>
      </footer>
    </main>
  );
}

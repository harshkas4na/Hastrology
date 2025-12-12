'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Hero } from '@/components/Hero';
import { BirthDetailsForm } from '@/components/BirthDetailsForm';
import { HoroscopeSection } from '@/components/HoroscopeSection';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';

export default function Home() {
  const { publicKey, connected } = useWallet();
  const { setWallet, setUser, user, reset } = useStore();
  const [checkingUser, setCheckingUser] = useState(false);

  // Check if user profile exists when wallet connects
  useEffect(() => {
    const checkUserProfile = async () => {
      if (connected && publicKey) {
        setWallet(publicKey.toBase58());
        setCheckingUser(true);

        try {
          const profileResponse = await api.getUserProfile(publicKey.toBase58());

          if (profileResponse && profileResponse.user) {
            // User exists - set in store
            setUser(profileResponse.user);
          } else {
            // New user - clear user from store
            setUser(null);
          }
        } catch (error) {
          console.error('Error checking user profile:', error);
          // If there's an error, treat as new user
          setUser(null);
        } finally {
          setCheckingUser(false);
        }
      } else {
        reset();
      }
    };

    checkUserProfile();
  }, [connected, publicKey]);

  return (
    <main className="relative">
      {/* Hero Section */}
      <Hero />

      {/* Loading state while checking user */}
      {connected && checkingUser && (
        <section className="min-h-screen flex items-center justify-center">
          <div className="glass-panel rounded-3xl p-12 text-center">
            <div className="cosmic-loader mb-4"></div>
            <p className="text-slate-400 text-lg">Checking your profile...</p>
          </div>
        </section>
      )}

      {/* Birth Details Form - only show for NEW users (when user is null) */}
      {connected && !checkingUser && !user && <BirthDetailsForm />}

      {/* Horoscope Section - show when user exists (registered) */}
      {connected && !checkingUser && user && <HoroscopeSection />}

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

'use client';

import dynamic from 'next/dynamic';
import { FC } from 'react';
import { motion } from 'framer-motion';

// Import wallet button with no SSR
const WalletMultiButtonDynamic = dynamic(
    async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
    { ssr: false }
);

export const Hero: FC = () => {
    return (
        <section className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-indigo-950 via-purple-950 to-fuchsia-950">
            {/* Animated background with better visual */}
            <div className="absolute inset-0 overflow-hidden opacity-50">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(124,58,237,0.1),transparent_50%)]"></div>
                <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,rgba(124,58,237,0.03),rgba(236,72,153,0.03),rgba(124,58,237,0.03))] animate-spin-slow"></div>
            </div>

            {/* Content */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="relative z-10 text-center px-4 max-w-4xl mx-auto"
            >
                <motion.h1
                    className="text-6xl md:text-8xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-yellow-500"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.8 }}
                >
                    Hastrology
                </motion.h1>

                <motion.p
                    className="text-xl md:text-2xl text-gray-300 mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                >
                    Discover Your Cosmic Path
                </motion.p>

                <motion.p
                    className="text-lg text-gray-400 mb-12"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.8 }}
                >
                    AI-Powered Horoscopes on Solana ✨
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8, duration: 0.8 }}
                    className="flex flex-col items-center gap-4"
                >
                    <div className="text-sm text-gray-400 mb-2">
                        Connect your Solana wallet to begin
                    </div>

                    <WalletMultiButtonDynamic className="!bg-gradient-to-r !from-purple-600 !to-pink-600 hover:!from-purple-700 hover:!to-pink-700 !transition-all !duration-300 !rounded-full !px-8 !py-4 !text-lg !font-semibold" />
                </motion.div>
            </motion.div>
        </section>
    );
};

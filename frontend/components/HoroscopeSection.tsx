'use client';

import { FC, useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { AstroCardDeck } from './AstroCardDeck';
import { AstroCardsData, CardType, AstroCard as AstroCardType, CARD_ORDER } from '@/types';

const PAYMENT_AMOUNT = 0.01; // SOL

// Demo cards for preview mode
const DEMO_CARDS: Record<CardType, AstroCardType> = {
    overall_vibe: {
        title: 'YOUR VIBE TODAY',
        tagline: "Today, you're giving...",
        content: 'main character energy ✨',
        footer: 'Stars powered by delusion + destiny.'
    },
    shine: {
        title: 'YOU WILL SHINE AT',
        tagline: 'You will shine at _______ today.',
        content: 'smart decisions',
        footer: 'Your moment is loading...'
    },
    health: {
        title: 'HEALTH CHECK',
        tagline: 'Your body is sending a push notification:',
        content: 'hydrate before you overthink',
        footer: 'Self-care is your superpower.'
    },
    wealth: {
        title: 'MONEY MOOD',
        tagline: 'The money mood today:',
        content: 'unexpected blessings loading',
        footer: 'Abundance is your vibe.'
    },
    career: {
        title: 'WORK AURA',
        tagline: 'Your work aura today:',
        content: 'quiet competence',
        footer: 'Success looks good on you.'
    },
    love: {
        title: 'HEART ALGORITHM',
        tagline: 'Heart algorithm update:',
        content: 'someone thinks about you',
        footer: 'Love is in the air.'
    },
    social: {
        title: 'SOCIAL BATTERY',
        tagline: 'Your social battery is at:',
        content: '70% — selective plans only',
        footer: 'Choose your energy wisely.'
    },
    growth: {
        title: 'UNIVERSE WHISPERS',
        tagline: 'Universe is whispering:',
        content: "you're closer than you think",
        footer: 'Trust the journey.'
    },
    luck: {
        title: 'LUCKY GLITCH',
        tagline: 'Your lucky glitch today:',
        content: 'small win incoming',
        footer: 'Luck is on your side.'
    },
    wild_card: {
        title: 'PLOT TWIST',
        tagline: 'Plot twist alert:',
        content: "today's delusion might work",
        footer: 'Expect the unexpected.'
    }
};

export const HoroscopeSection: FC = () => {
    const { publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const { user, cards, setCards, loading, setLoading } = useStore();

    const [status, setStatus] = useState<'checking' | 'ready' | 'paying' | 'generating' | 'complete'>('checking');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (publicKey && user) {
            checkStatus();
        }
    }, [publicKey, user]);

    const checkStatus = async () => {
        if (!publicKey) return;

        try {
            const result = await api.getStatus(publicKey.toBase58());

            if (result.status === 'exists' && result.cards) {
                setCards(result.cards);
                setStatus('complete');
            } else {
                setStatus('ready');
            }
        } catch (err) {
            console.error('Failed to check status:', err);
            setStatus('ready');
        }
    };

    const handlePayment = async () => {
        if (!publicKey || !sendTransaction) return;

        setLoading(true);
        setError(null);
        setStatus('paying');

        try {
            // Create payment transaction (0.01 SOL to self for now)
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: publicKey, // In production, this would be your treasury wallet
                    lamports: PAYMENT_AMOUNT * LAMPORTS_PER_SOL
                })
            );

            const signature = await sendTransaction(transaction, connection);

            // Generate horoscope cards
            setStatus('generating');
            const result = await api.confirmHoroscope(publicKey.toBase58(), signature);

            setCards(result.cards);
            setStatus('complete');
        } catch (err: any) {
            setError(err.message || 'Failed to process payment');
            setStatus('ready');
        } finally {
            setLoading(false);
        }
    };

    const handleDemo = async () => {
        setLoading(true);
        setError(null);
        setStatus('generating');

        // Simulate generation delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Use demo cards
        setCards(DEMO_CARDS);
        setStatus('complete');
        setLoading(false);
    };

    const handleNewReading = () => {
        setCards(null);
        setStatus('ready');
    };

    if (!user || !publicKey) {
        return null;
    }

    return (
        <section id="horoscope-section" className="min-h-screen flex items-center justify-center py-20 px-4 relative">
            {/* Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px]"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="w-full max-w-3xl relative z-10"
            >
                {status === 'ready' && (
                    <div className="glass-panel rounded-3xl p-8 md:p-12 text-center border-t border-white/10">
                        <div className="inline-block p-4 rounded-full bg-purple-500/10 mb-6 animate-pulse-slow">
                            <span className="text-4xl">✨</span>
                        </div>

                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-pink-200">
                            Ready for Your Astro Cards?
                        </h2>
                        <p className="text-slate-400 mb-10 text-lg max-w-xl mx-auto">
                            Get your personalized daily horoscope cards. 10 cards covering your vibe, health, wealth, love & more.
                        </p>

                        {error && (
                            <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm flex items-center justify-center gap-2">
                                <span className="text-lg">⚠️</span> {error}
                            </div>
                        )}

                        <div className="">
                            {/* Payment Option */}
                            <div className="group relative">
                                <button
                                    onClick={handlePayment}
                                    disabled={loading}
                                    className="relative w-full h-full bg-slate-900 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:bg-slate-800 transition-all duration-300"
                                >
                                    <div className="text-purple-400 font-bold tracking-wider text-sm uppercase">Full Reading</div>
                                    <div className="text-3xl font-bold text-white">{PAYMENT_AMOUNT} SOL</div>
                                    <div className="text-slate-500 text-sm">10 AI-Powered Cards</div>
                                    <div className="w-full py-3 mt-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white font-bold shadow-lg shadow-purple-900/20 group-hover:shadow-purple-600/40 transition-all">
                                        {loading ? 'Processing...' : 'Unlock Cards'}
                                    </div>
                                </button>
                            </div>

                            {/* Demo Option */}
                            {/* <button
                                onClick={handleDemo}
                                disabled={loading}
                                className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:bg-white/5 transition-all duration-300 border border-white/5 hover:border-blue-400/30 group"
                            >
                                <div className="text-blue-400 font-bold tracking-wider text-sm uppercase">Preview</div>
                                <div className="text-3xl font-bold text-white">Free</div>
                                <div className="text-slate-500 text-sm">Sample Cards</div>
                                <div className="w-full py-3 mt-2 bg-slate-800 text-blue-300 rounded-xl font-bold border border-blue-500/20 group-hover:bg-blue-500/10 group-hover:text-blue-200 transition-all">
                                    Try Demo
                                </div>
                            </button> */}
                        </div>
                    </div>
                )}

                {(status === 'paying' || status === 'generating') && (
                    <div className="glass-panel rounded-3xl p-16 text-center">
                        <div className="cosmic-loader mb-8"></div>
                        <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                            {status === 'paying' ? 'Confirming Transaction...' : 'Generating Your Cards...'}
                        </h3>
                        <p className="text-slate-400 text-lg animate-pulse">
                            {status === 'paying' ? 'Please approve the request in your wallet' : 'AI is crafting your cosmic cards ✨'}
                        </p>
                    </div>
                )}

                {status === 'complete' && cards && (
                    <div className="w-full">
                        <AstroCardDeck
                            cards={cards}
                            onComplete={handleNewReading}
                        />

                        {/* New Reading Button */}
                        <motion.div
                            className="flex justify-center mt-8"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <button
                                onClick={handleNewReading}
                                className="py-3 px-8 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all border border-white/5 hover:border-white/10"
                            >
                                ↻ New Reading
                            </button>
                        </motion.div>
                    </div>
                )}
            </motion.div>
        </section>
    );
};


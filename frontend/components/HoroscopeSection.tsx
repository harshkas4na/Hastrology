'use client';

import { FC, useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';

const PAYMENT_AMOUNT = 0.01; // SOL

export const HoroscopeSection: FC = () => {
    const { publicKey, sendTransaction } = useWallet();
    const { connection } = useConnection();
    const { user, horoscope, setHoroscope, loading, setLoading } = useStore();

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

            if (result.status === 'exists' && result.horoscope) {
                setHoroscope(result.horoscope);
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

            // Wait for confirmation
            await connection.confirmTransaction(signature, 'confirmed');

            // Generate horoscope
            setStatus('generating');
            const result = await api.confirmHoroscope(publicKey.toBase58(), signature);

            setHoroscope(result.horoscope_text);
            setStatus('complete');
        } catch (err: any) {
            setError(err.message || 'Failed to process payment');
            setStatus('ready');
        } finally {
            setLoading(false);
        }
    };

    if (!user || !publicKey) {
        return null;
    }

    return (
        <section id="horoscope-section" className="min-h-screen flex items-center justify-center py-20 px-4 bg-gradient-to-b from-slate-900 to-purple-900">
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="w-full max-w-2xl"
            >
                {status === 'ready' && (
                    <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/20 shadow-xl shadow-purple-500/10">
                        <h2 className="text-3xl font-bold text-white mb-4 text-center">
                            Ready to Discover Your Horoscope?
                        </h2>
                        <p className="text-gray-300 text-center mb-8">
                            Payment: {PAYMENT_AMOUNT} SOL
                        </p>

                        {error && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handlePayment}
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95"
                        >
                            {loading ? 'Processing...' : `Pay ${PAYMENT_AMOUNT} SOL & Generate`}
                        </button>
                    </div>
                )}

                {(status === 'paying' || status === 'generating') && (
                    <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-12 border border-purple-500/20 shadow-xl shadow-purple-500/10 text-center">
                        <div className="cosmic-loader mb-6"></div>
                        <h3 className="text-2xl font-bold text-white mb-2">
                            {status === 'paying' ? 'Processing Payment...' : 'Generating Your Horoscope...'}
                        </h3>
                        <p className="text-gray-400">
                            {status === 'paying' ? 'Confirming transaction on Solana' : 'Our AI is reading the stars for you'}
                        </p>
                    </div>
                )}

                {status === 'complete' && horoscope && (
                    <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/30 shadow-2xl shadow-purple-500/20">
                        <h2 className="text-3xl font-bold text-white mb-6 text-center">
                            Your Cosmic Reading ✨
                        </h2>

                        <div className="prose prose-invert max-w-none mb-8">
                            <p className="text-gray-200 text-lg leading-relaxed whitespace-pre-wrap">
                                {horoscope}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-all"
                            >
                                Generate New Horoscope
                            </button>

                            <button
                                onClick={() => {
                                    // Share functionality will be implemented
                                    alert('Share feature coming soon!');
                                }}
                                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all"
                            >
                                Share on X
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </section>
    );
};

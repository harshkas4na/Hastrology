'use client';

import { FC, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';

export const BirthDetailsForm: FC = () => {
    const { publicKey } = useWallet();
    const { setUser, setLoading } = useStore();

    const [formData, setFormData] = useState({
        dob: '',
        birthTime: '',
        birthPlace: ''
    });
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!publicKey) {
            setError('Please connect your wallet first');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const result = await api.registerUser({
                walletAddress: publicKey.toBase58(),
                ...formData
            });

            setUser(result.user);

            // Scroll to next section
            document.getElementById('horoscope-section')?.scrollIntoView({ behavior: 'smooth' });
        } catch (err: any) {
            setError(err.message || 'Failed to register. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isFormValid = formData.dob && formData.birthTime && formData.birthPlace;

    return (
        <section id="birth-form" className="min-h-screen flex items-center justify-center py-20 px-4 bg-slate-900">
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="w-full max-w-md"
            >
                <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl p-8 border border-purple-500/20 shadow-xl shadow-purple-500/10">
                    <h2 className="text-3xl font-bold text-white mb-2 text-center">
                        Your Birth Details
                    </h2>
                    <p className="text-gray-400 text-center mb-8">
                        Enter your information to receive your horoscope
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Date of Birth */}
                        <div>
                            <label htmlFor="dob" className="block text-sm font-medium text-gray-300 mb-2">
                                Date of Birth
                            </label>
                            <input
                                type="date"
                                id="dob"
                                required
                                value={formData.dob}
                                onChange={(e) => setFormData(prev => ({ ...prev, dob: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {/* Birth Time */}
                        <div>
                            <label htmlFor="birthTime" className="block text-sm font-medium text-gray-300 mb-2">
                                Time of Birth
                            </label>
                            <input
                                type="time"
                                id="birthTime"
                                required
                                value={formData.birthTime}
                                onChange={(e) => setFormData(prev => ({ ...prev, birthTime: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {/* Birth Place */}
                        <div>
                            <label htmlFor="birthPlace" className="block text-sm font-medium text-gray-300 mb-2">
                                Place of Birth
                            </label>
                            <input
                                type="text"
                                id="birthPlace"
                                required
                                placeholder="e.g., New Delhi, India"
                                value={formData.birthPlace}
                                onChange={(e) => setFormData(prev => ({ ...prev, birthPlace: e.target.value }))}
                                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!isFormValid || !publicKey}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95"
                        >
                            Continue →
                        </button>
                    </form>

                    <p className="text-xs text-gray-500 text-center mt-6">
                        Your information is stored securely on-chain
                    </p>
                </div>
            </motion.div>
        </section>
    );
};

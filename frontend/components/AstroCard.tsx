'use client';

import { FC } from 'react';
import { motion } from 'framer-motion';
import { CardType, AstroCard as AstroCardType, CARD_COLORS } from '@/types';

interface AstroCardProps {
    card: AstroCardType;
    cardType: CardType;
    index: number;
    isActive?: boolean;
    onShare?: () => void;
}

export const AstroCard: FC<AstroCardProps> = ({
    card,
    cardType,
    index,
    isActive = true,
    onShare
}) => {
    const colorConfig = CARD_COLORS[cardType];

    const handleShare = async () => {
        if (onShare) {
            onShare();
            return;
        }

        // Default share behavior - copy to clipboard
        const shareText = `${card.tagline}\n\n✨ ${card.content} ✨\n\n${card.footer}\n\n🔮 Get your daily astro at hastrology.xyz`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: card.title,
                    text: shareText,
                });
            } else {
                await navigator.clipboard.writeText(shareText);
                // Could show a toast here
            }
        } catch (err) {
            console.error('Share failed:', err);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{
                opacity: isActive ? 1 : 0.3,
                scale: isActive ? 1 : 0.85,
                y: 0
            }}
            transition={{
                duration: 0.5,
                delay: index * 0.05,
                ease: [0.16, 1, 0.3, 1]
            }}
            className="astro-card relative w-full max-w-md mx-auto"
            style={{
                aspectRatio: '9/16',
                maxHeight: '70vh'
            }}
        >
            {/* Card Background with Gradient */}
            <div
                className="absolute inset-0 rounded-3xl overflow-hidden"
                style={{ background: colorConfig.gradient }}
            >
                {/* Decorative Elements */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-10 right-10 w-32 h-32 rounded-full blur-3xl bg-white/30" />
                    <div className="absolute bottom-20 left-10 w-24 h-24 rounded-full blur-2xl bg-black/20" />
                </div>

                {/* Noise Texture Overlay */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")'
                    }}
                />
            </div>

            {/* Card Content */}
            <div className="relative h-full flex flex-col justify-between p-8 text-white">
                {/* Top Section - Card Number & Title */}
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-lg font-bold opacity-60">
                            {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="h-px flex-1 bg-white/20" />
                    </div>

                    <h2 className="text-sm font-bold tracking-[0.3em] uppercase opacity-80 mb-2">
                        {card.title}
                    </h2>

                    <p className="text-lg font-medium opacity-70 leading-relaxed">
                        {card.tagline}
                    </p>
                </div>

                {/* Middle Section - Main Content */}
                <div className="flex-1 flex items-center justify-center py-10">
                    <motion.p
                        className="text-3xl md:text-4xl font-bold text-center leading-tight"
                        style={{ textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                    >
                        {card.content}
                    </motion.p>
                </div>

                {/* Bottom Section - Footer & Share */}
                <div className="space-y-4">
                    <p className="text-sm opacity-50 text-center">
                        {card.footer}
                    </p>

                    {/* Share Button */}
                    <button
                        onClick={handleShare}
                        className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/20 
                                   backdrop-blur-sm border border-white/20 
                                   text-white font-semibold text-sm
                                   transition-all duration-300 hover:scale-[1.02]
                                   flex items-center justify-center gap-2"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                            />
                        </svg>
                        Share Card
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

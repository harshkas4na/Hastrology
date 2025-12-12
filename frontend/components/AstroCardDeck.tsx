'use client';

import { FC, useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { AstroCard } from './AstroCard';
import {
    CardType,
    AstroCard as AstroCardType,
    CARD_ORDER,
    CARD_COLORS
} from '@/types';

interface AstroCardDeckProps {
    cards: Record<CardType, AstroCardType>;
    onComplete?: () => void;
}

export const AstroCardDeck: FC<AstroCardDeckProps> = ({ cards, onComplete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);

    const cardTypes = CARD_ORDER;
    const currentCardType = cardTypes[currentIndex];
    const currentCard = cards[currentCardType];

    const goToNext = useCallback(() => {
        if (currentIndex < cardTypes.length - 1) {
            setDirection(1);
            setCurrentIndex(prev => prev + 1);
        } else if (onComplete) {
            onComplete();
        }
    }, [currentIndex, cardTypes.length, onComplete]);

    const goToPrev = useCallback(() => {
        if (currentIndex > 0) {
            setDirection(-1);
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    const goToCard = useCallback((index: number) => {
        setDirection(index > currentIndex ? 1 : -1);
        setCurrentIndex(index);
    }, [currentIndex]);

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const threshold = 50;
        if (info.offset.x < -threshold) {
            goToNext();
        } else if (info.offset.x > threshold) {
            goToPrev();
        }
    };

    const slideVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
            scale: 0.9
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (direction: number) => ({
            x: direction > 0 ? '-100%' : '100%',
            opacity: 0,
            scale: 0.9
        })
    };

    return (
        <div className="relative w-full min-h-[80vh] flex flex-col items-center justify-center">
            {/* Header */}
            <motion.div
                className="text-center mb-6"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <span className="inline-block py-1 px-4 rounded-full bg-white/5 text-white/60 text-xs font-bold tracking-widest uppercase mb-2 border border-white/10">
                    Your Daily Astro
                </span>
                <h2 className="text-2xl font-bold text-white">
                    Cosmic Stats Refreshed ✨
                </h2>
            </motion.div>

            {/* Cards Container */}
            <div className="relative w-full max-w-md mx-auto px-4" style={{ height: '60vh' }}>
                <AnimatePresence initial={false} custom={direction} mode="wait">
                    <motion.div
                        key={currentIndex}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 },
                            scale: { duration: 0.2 }
                        }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.2}
                        onDragEnd={handleDragEnd}
                        className="absolute inset-0"
                    >
                        <AstroCard
                            card={currentCard}
                            cardType={currentCardType}
                            index={currentIndex}
                            isActive={true}
                        />
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Controls */}
            <div className="flex flex-col items-center gap-6 mt-6">
                {/* Progress Dots */}
                <div className="flex gap-2">
                    {cardTypes.map((type, idx) => (
                        <button
                            key={type}
                            onClick={() => goToCard(idx)}
                            className="group relative p-1"
                            aria-label={`Go to ${type} card`}
                        >
                            <div
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentIndex
                                        ? 'w-6 bg-white'
                                        : idx < currentIndex
                                            ? 'bg-white/40'
                                            : 'bg-white/20'
                                    }`}
                                style={idx === currentIndex ? { backgroundColor: CARD_COLORS[type].color } : {}}
                            />
                        </button>
                    ))}
                </div>

                {/* Arrow Navigation */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={goToPrev}
                        disabled={currentIndex === 0}
                        className="p-3 rounded-full bg-white/5 border border-white/10 text-white
                                   hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed
                                   transition-all duration-300"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <span className="text-white/60 text-sm font-medium min-w-[60px] text-center">
                        {currentIndex + 1} / {cardTypes.length}
                    </span>

                    <button
                        onClick={goToNext}
                        disabled={currentIndex === cardTypes.length - 1}
                        className="p-3 rounded-full bg-white/5 border border-white/10 text-white
                                   hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed
                                   transition-all duration-300"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>

                {/* Swipe Hint */}
                <p className="text-white/30 text-xs">
                    Swipe or tap arrows to navigate
                </p>
            </div>
        </div>
    );
};

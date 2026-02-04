"use client";

import { useEffect, useRef } from "react";

interface StarBackgroundProps {
    showSuccessOrb?: boolean;
}

export function StarBackground({ showSuccessOrb = false }: StarBackgroundProps) {
    const starsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!starsRef.current) return;

        // Generate stars
        const container = starsRef.current;
        container.innerHTML = "";

        for (let i = 0; i < 100; i++) {
            const star = document.createElement("div");
            star.className = "star";
            star.style.left = `${Math.random() * 100}%`;
            star.style.top = `${Math.random() * 100}%`;
            star.style.animationDelay = `${Math.random() * 3}s`;
            const size = Math.random() * 2 + 1;
            star.style.width = `${size}px`;
            star.style.height = `${size}px`;
            container.appendChild(star);
        }
    }, []);

    return (
        <>
            {/* Stars */}
            <div ref={starsRef} className="stars-bg" />

            {/* Gradient orbs */}
            <div className="orb orb-purple" />
            <div className="orb orb-gold" />

            {/* Success orb for results screen */}
            <div className={`orb orb-success ${showSuccessOrb ? "active" : ""}`} />
        </>
    );
}

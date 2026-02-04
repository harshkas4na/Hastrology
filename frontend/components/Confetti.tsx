"use client";

import { useEffect, useRef, useState } from "react";

const COLORS = ["#22c55e", "#d4a017", "#f5c842", "#8b5cf6", "#6366f1", "#ffffff"];

export function Confetti() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        container.innerHTML = "";

        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement("div");
            confetti.className = "confetti-piece";
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
            confetti.style.animationDelay = `${Math.random() * 0.5}s`;
            confetti.style.borderRadius = Math.random() > 0.5 ? "50%" : "0";
            container.appendChild(confetti);
        }

        // Hide after animation
        const timer = setTimeout(() => {
            setIsActive(false);
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    if (!isActive) return null;

    return <div ref={containerRef} className="confetti" />;
}

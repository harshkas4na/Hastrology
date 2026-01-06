"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FC, useEffect } from "react";

interface ToastProps {
	message: string | null;
	type?: "error" | "success" | "info";
	onClose: () => void;
	duration?: number;
}

export const Toast: FC<ToastProps> = ({
	message,
	type = "error",
	onClose,
	duration = 5000,
}) => {
	useEffect(() => {
		if (message) {
			const timer = setTimeout(() => {
				onClose();
			}, duration);

			return () => clearTimeout(timer);
		}
	}, [message, duration, onClose]);

	const getToastStyles = () => {
		switch (type) {
			case "error":
				return {
					bg: "bg-red-500/10",
					border: "border-red-500/30",
					icon: "⚠️",
					iconBg: "bg-red-500/20",
					text: "text-red-300",
				};
			case "success":
				return {
					bg: "bg-green-500/10",
					border: "border-green-500/30",
					icon: "✓",
					iconBg: "bg-green-500/20",
					text: "text-green-300",
				};
			case "info":
				return {
					bg: "bg-blue-500/10",
					border: "border-blue-500/30",
					icon: "ℹ️",
					iconBg: "bg-blue-500/20",
					text: "text-blue-300",
				};
			default:
				return {
					bg: "bg-red-500/10",
					border: "border-red-500/30",
					icon: "⚠️",
					iconBg: "bg-red-500/20",
					text: "text-red-300",
				};
		}
	};

	const styles = getToastStyles();

	return (
		<AnimatePresence>
			{message && (
				<motion.div
					initial={{ opacity: 0, y: 50, scale: 0.9 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 50, scale: 0.9 }}
					transition={{ duration: 0.3, ease: "easeOut" }}
					className="fixed bottom-6 right-6 z-50 max-w-md"
				>
					<div
						className={`${styles.bg} ${styles.border} border backdrop-blur-xl rounded-2xl p-4 shadow-2xl`}
					>
						<div className="flex items-start gap-3">
							{/* Icon */}
							<div
								className={`${styles.iconBg} rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0`}
							>
								<span className="text-lg">{styles.icon}</span>
							</div>
							<div className="flex-1 pt-0.5">
								<p
									className={`${styles.text} text-sm font-medium leading-relaxed`}
								>
									{message}
								</p>
							</div>

							<button
								onClick={onClose}
								className="text-white/40 hover:text-white/80 transition-colors flex-shrink-0"
								aria-label="Close"
								type="button"
							>
								<svg
									className="w-5 h-5"
									fill="none"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<title>svg</title>
									<path d="M6 18L18 6M6 6l12 12"></path>
								</svg>
							</button>
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	);
};

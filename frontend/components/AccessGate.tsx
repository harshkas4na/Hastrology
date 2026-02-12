"use client";

import Image from "next/image";
import { useState, useEffect, type ReactNode, type FormEvent } from "react";

const ACCESS_CODE = process.env.NEXT_PUBLIC_ACCESS_CODE;
const STORAGE_KEY = "hastrology_access";

export default function AccessGate({ children }: { children: ReactNode }) {
	const [authorized, setAuthorized] = useState(false);
	const [loading, setLoading] = useState(true);
	const [code, setCode] = useState("");
	const [error, setError] = useState(false);

	useEffect(() => {
		if (!ACCESS_CODE) {
			setAuthorized(true);
			setLoading(false);
			return;
		}
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === ACCESS_CODE) {
			setAuthorized(true);
		}
		setLoading(false);
	}, []);

	if (loading) return null;
	if (authorized) return <>{children}</>;

	const handleSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (code.trim() === ACCESS_CODE) {
			localStorage.setItem(STORAGE_KEY, code.trim());
			setAuthorized(true);
			setError(false);
		} else {
			setError(true);
		}
	};

	return (
		<div className="fixed inset-0 z-[9999] bg-[#0a0a0f] flex items-center justify-center px-4">
			{/* Background orbs */}
			<div className="orb orb-purple" />
			<div className="orb orb-gold" />

			<div className="card-glass relative z-10 flex flex-col items-center text-center screen-fade-in">
				{/* Title */}
				<h1
					className="text-3xl sm:text-4xl font-bold mb-2"
					style={{ fontFamily: "'Space Grotesk', sans-serif" }}
				>
					<Image src="/logo/hast.png" alt="Logo" width={200} height={200} />
				</h1>
				<p className="text-sm text-white/40 mb-8">
					Enter your access code to continue
				</p>

				<form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
					<input
						type="text"
						value={code}
						onChange={(e) => {
							setCode(e.target.value);
							setError(false);
						}}
						placeholder="Access code"
						autoFocus
						className="form-input text-center tracking-widest uppercase"
					/>

					{error && (
						<p className="text-sm text-red-400">
							Invalid access code. Please try again.
						</p>
					)}

					<button type="submit" className="btn-primary w-full">
						Enter
					</button>
				</form>
			</div>
		</div>
	);
}

import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/WalletContextProvider";

const outfit = Outfit({
	subsets: ["latin"],
	variable: "--font-outfit",
	display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
	subsets: ["latin"],
	variable: "--font-jakarta",
	display: "swap",
});

export const metadata: Metadata = {
	title: "Hastrology - AI-Powered Horoscopes on Solana",
	description:
		"Discover your cosmic path with AI-generated horoscopes. Pay with Solana, share on X, and enter daily lottery.",
	keywords: ["horoscope", "astrology", "solana", "crypto", "AI", "web3"],
	authors: [{ name: "Hastrology" }],
	openGraph: {
		title: "Hastrology - Your Cosmic Path On-Chain",
		description: "AI-Powered Horoscopes on Solana",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Hastrology",
		description: "AI-Powered Horoscopes on Solana",
	},
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html className="scroll-smooth" lang="en">
			<body
				className={`${outfit.variable} ${jakarta.variable} font-sans bg-black text-white antialiased`}
			>
				<Web3Provider>{children}</Web3Provider>
			</body>
		</html>
	);
}

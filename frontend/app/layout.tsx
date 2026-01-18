import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/WalletContextProvider";

const montserrat = Montserrat({
	subsets: ["latin"],
	variable: "--font-montserrat",
	weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "Hashtro - AI-Powered Horoscopes on Solana",
	description:
		"Discover your cosmic path with AI-generated horoscopes. Pay with Solana, share on X, and enter daily lottery.",
	keywords: ["horoscope", "astrology", "solana", "crypto", "AI", "web3"],
	authors: [{ name: "Hashtro" }],
	openGraph: {
		title: "Hashtro - Your Cosmic Path On-Chain",
		description: "AI-Powered Horoscopes on Solana",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Hashtro",
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
				className={`${montserrat.className} bg-black text-white antialiased`}
			>
				<Web3Provider>{children}</Web3Provider>
			</body>
		</html>
	);
}

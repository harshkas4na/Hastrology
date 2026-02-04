import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/components/WalletContextProvider";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
	weight: ["300", "400", "500", "600", "700"],
	display: "swap",
});

const spaceGrotesk = Space_Grotesk({
	subsets: ["latin"],
	variable: "--font-space-grotesk",
	weight: ["300", "400", "500", "600", "700"],
	display: "swap",
});


export const metadata: Metadata = {
	title: "Hashtro - AI-Powered Horoscopes on Solana",
	description:
		"Discover your cosmic path with AI-generated horoscopes. Pay with Solana, share on X, and enter daily lottery.",
	keywords: ["horoscope", "astrology", "solana", "crypto", "AI", "web3"],
	authors: [{ name: "Hashtro" }],
	icons: {
		icon: "/logo/logo.svg",
		shortcut: "/logo/logo.svg",
		apple: "/logo/logo.svg",
	},
	openGraph: {
		title: "Hashtro - Your Cosmic Path On-Chain",
		description: "AI-Powered Horoscopes on Solana",
		type: "website",
		images: [
			{
				url: "/logo/hast.svg",
				width: 1200,
				height: 630,
				alt: "Hashtro",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Hashtro",
		description: "AI-Powered Horoscopes on Solana",
		images: ["/logo/hast.svg"],
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
				className={`${inter.variable} ${spaceGrotesk.variable} font-sans bg-[#0a0a0f] text-white antialiased`}
			>
				<Web3Provider>{children}</Web3Provider>
			</body>
		</html>
	);
}

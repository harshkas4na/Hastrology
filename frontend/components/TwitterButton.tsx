import { useState } from "react";
import { getAuthUrl } from "@/lib/twitter";

interface TwitterSignInButtonProps {
	disabled?: boolean;
	onError?: (error: string) => void;
	userId: string;
}

export const TwitterSignInButton: React.FC<TwitterSignInButtonProps> = ({
	disabled = false,
	onError,
	userId,
}) => {
	const [isLoading, setIsLoading] = useState(false);

	const handleTwitterSignIn = async () => {
		try {
			setIsLoading(true);
			const authUrl = getAuthUrl("twitter", window.location.href, userId);

			if (authUrl) {
				window.location.href = authUrl;
			} else {
				throw new Error("Failed to get Twitter auth URL");
			}
		} catch (error) {
			console.error("Twitter sign-in error:", error);
			setIsLoading(false);
			onError?.("Failed to initiate Twitter sign-in");
		}
	};

	return (
		<button
			onClick={handleTwitterSignIn}
			disabled={disabled || isLoading}
			className={`
        w-full
        flex
        items-center
        justify-center
        gap-3
        rounded-2xl
       px-8 py-4
        transition-all
        border border-[#fc5411]
        ${
					disabled || isLoading
						? "bg-white/5 text-gray-500 border-[#2A2A2A] cursor-not-allowed opacity-60"
						: "bg-white/5 text-white border-[#2A2A2A] hover:bg-[#262626] hover:border-[#3A3A3A]"
				}
      `}
			type="button"
		>
			<svg
				viewBox="0 0 24 24"
				aria-hidden="true"
				className="w-5 h-5 fill-current"
			>
				<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
			</svg>
			{isLoading ? "Connecting..." : "Sign in with X"}
		</button>
	);
};

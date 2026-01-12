"use client";

import { FC } from "react";
import { useStore } from "@/store/useStore";

export const UserXDetails: FC = () => {
	const { user } = useStore();

	if (!user?.twitterUsername) return null;

	const profileUrl = `https://x.com/${user.twitterUsername}`;

	return (
		<div
			className="
    absolute z-50
    inset-x-0 top-6
    flex justify-center
    md:inset-auto md:top-6 md:left-5
    md:justify-start
  "
		>
			<a
				href={profileUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="
          flex flex-row gap-2 items-center
          bg-[#1F1F1F]
          border border-[#FC5411]
          text-white
          px-4
          py-2
          rounded-xl
          font-medium
          hover:bg-[#262626]
          hover:shadow-[0_0_20px_rgba(252,84,17,0.35)]
          transition
          cursor-pointer
        "
			>
				<svg
					viewBox="0 0 24 24"
					aria-hidden="true"
					className="hidden md:block w-5 h-5 fill-current"
				>
					<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
				</svg>

				{user.twitterProfileUrl && (
					<img
						alt="X profile"
						className="w-5 h-5 rounded-full"
						src={user.twitterProfileUrl}
					/>
				)}

				<span className="text-sm md:text-lg">@{user.twitterUsername}</span>
			</a>
		</div>
	);
};

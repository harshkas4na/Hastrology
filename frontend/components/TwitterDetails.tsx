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
   relative md:absolute
z-50
flex items-center
md:top-6 md:left-5 left-3 mt-5 md:mt-0

  "
		>
			<a
				href={profileUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="
          flex flex-row gap-2 items-center
          bg-inherit

          border border-neutral-700
          text-white
		  cursor-pointer
          px-4
          py-1.5
          rounded-xl
          font-medium
          hover:bg-[#262626]
          hover:shadow-[0_0_20px_rgba(252,84,17,0.35)]
          transition
          hover:scale-105
        "
			>
				{user.twitterProfileUrl && (
					<img
						alt="X profile"
						className="w-6.5 h-7 rounded-full"
						src={user.twitterProfileUrl}
					/>
				)}

				<span className="text-white/90 font-display text-sm md:text-md">@{user.twitterUsername}</span>
			</a>
		</div>
	);
};

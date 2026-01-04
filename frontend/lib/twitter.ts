import { FetchUserResult, fetchUserInput, TwitterUserData } from "@/types";
import { joinPath } from "./utils";

const X_USER_URL =
	"https://api.twitter.com/2/users/me?user.fields=profile_image_url";
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

export async function fetchXUser(
	input: fetchUserInput,
): Promise<FetchUserResult | null> {
	const originalProtocol =
		process.env.NEXT_PUBLIC_NODE_ENV === "development" ? "http" : "https";

	const secret = btoa(
		`${process.env.NEXT_PUBLIC_X_CLIENT_ID}:${process.env.NEXT_PUBLIC_X_CLIENT_SECRET as string}`,
	);

	const oauthRawResponse = await fetch(X_TOKEN_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${secret}`,
		},
		body: new URLSearchParams({
			code: input.code,
			grant_type: "authorization_code",
			client_id: (process.env.NEXT_PUBLIC_X_CLIENT_ID as string) || "",
			redirect_uri: joinPath(
				`${originalProtocol}://${input.url.host}`,
				"api",
				"auth",
				"twitter",
				"callback",
			),
			code_verifier: "challenge",
		}),
	});

	if (!oauthRawResponse.ok) {
		return null;
	}
	const oauthResponse = (await oauthRawResponse.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
	};
	if (!oauthResponse.access_token) {
		return null;
	}
	const TwitterUserData = await fetch(X_USER_URL, {
		headers: {
			Authorization: `Bearer ${oauthResponse.access_token}`,
		},
	});

	const userData: TwitterUserData = await TwitterUserData.json();

	return {
		userData,
		accessToken: oauthResponse.access_token,
		refreshToken: oauthResponse.refresh_token,
		expiresIn: oauthResponse.expires_in,
	};
}

export function getAuthUrl(
	platform: string,
	requestUrl: string,
	userId: string,
) {
	const authUrls = {
		twitter: generateXAuthUrl(requestUrl, userId),
	};
	return authUrls[platform as keyof typeof authUrls] || null;
}

export function generateXAuthUrl(requestUrl: string, userId = ""): string {
	const url = new URL(requestUrl);

	const originalProtocol =
		process.env.NEXT_PUBLIC_NODE_ENV === "development" ? "http" : "https";

	const state = JSON.stringify({
		user_id: userId,
	});

	const oauthUrl = new URLSearchParams({
		client_id: (process.env.NEXT_PUBLIC_X_CLIENT_ID as string) || "",
		redirect_uri: joinPath(
			`${originalProtocol}://${url.host}`,
			"api",
			"auth",
			"twitter",
			"callback",
		),
		prompt: "none",
		response_type: "code",
		code_challenge: "challenge",
		code_challenge_method: "plain",
		scope:
			"follows.write tweet.read tweet.write media.write users.read offline.access like.read",
		state: btoa(encodeURIComponent(state)),
	});

	return `https://x.com/i/oauth2/authorize?${oauthUrl}`;
}

export async function refreshTwitterToken(refreshToken: string): Promise<{
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
} | null> {
	const secret = btoa(
		`${process.env.NEXT_PUBLIC_X_CLIENT_ID}:${process.env.NEXT_PUBLIC_X_CLIENT_SECRET}`,
	);

	const response = await fetch(X_TOKEN_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Authorization: `Basic ${secret}`,
		},
		body: new URLSearchParams({
			refresh_token: refreshToken,
			grant_type: "refresh_token",
			client_id: process.env.NEXT_PUBLIC_X_CLIENT_ID || "",
		}),
	});

	if (!response.ok) {
		return null;
	}

	const data = await response.json();

	return {
		accessToken: data.access_token,
		refreshToken: data.refresh_token,
		expiresIn: data.expires_in,
	};
}

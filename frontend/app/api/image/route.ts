import { NextResponse } from "next/server";

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const imageUrl = searchParams.get("url");

	if (!imageUrl) {
		return new Response("Missing url", { status: 400 });
	}

	const res = await fetch(imageUrl);
	const buffer = await res.arrayBuffer();

	return new NextResponse(buffer, {
		headers: {
			"Content-Type": res.headers.get("content-type") || "image/jpeg",
			"Cache-Control": "public, max-age=86400",
		},
	});
}

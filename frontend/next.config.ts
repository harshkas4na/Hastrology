import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	devIndicators: false,
	webpack: (config, { isServer }) => {
		if (!isServer) {
			// Don't resolve 'fs' module on the client to prevent this error on build
			config.resolve.fallback = {
				fs: false,
				net: false,
				tls: false,
				crypto: false,
				path: false,
				os: false,
				stream: false,
				http: false,
				https: false,
				zlib: false,
			};
		}

		// Fix for @coral-xyz/anchor
		config.externals.push("pino-pretty", "lokijs", "encoding");

		return config;
	},
};

export default nextConfig;

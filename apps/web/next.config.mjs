import process from "node:process";

/** @type {import("next").NextConfig} */
const nextConfig = {
	output: "standalone",

	compiler: {
		removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
	},
};

export default nextConfig;

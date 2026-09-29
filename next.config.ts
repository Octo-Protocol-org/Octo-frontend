import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const apiUrl = process.env.NEXT_PUBLIC_OCTO_API_URL;

// Production builds must have a real HTTPS API URL — a missing or localhost value would ship a
// site that calls localhost and whitelists it in the CSP without any obvious error at deploy time.
if (isProd) {
  if (!apiUrl) {
    throw new Error(
      "[next.config] NEXT_PUBLIC_OCTO_API_URL is required for production builds. " +
        "Set it to your deployed API origin (https://...).",
    );
  }
  if (!apiUrl.startsWith("https://")) {
    throw new Error(
      `[next.config] NEXT_PUBLIC_OCTO_API_URL must use https: in production (got "${apiUrl}").`,
    );
  }
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

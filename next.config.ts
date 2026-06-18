import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'ryansautomation.com',
            },
            {
                protocol: 'https',
                hostname: 'user-images.githubusercontent.com',
            }
        ],
    },
};

export default nextConfig;

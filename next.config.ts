import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    async headers() {
        return [
            {
                source: '/share/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                    },
                ],
            },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'ryansautomation.com',
            },
            {
                protocol: 'https',
                hostname: 'user-images.githubusercontent.com',
            },
            {
                protocol: 'https',
                hostname: 'www.napleshomes.com',
            }
        ],
    },
};

export default nextConfig;

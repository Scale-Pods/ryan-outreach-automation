import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Ryan's Automation | AI Automation",
    description: "AI-Powered Marketing & Operations managed by ScalePods",
    icons: {
        icon: '/logo.png',
        shortcut: '/logo.png',
        apple: '/logo.png',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning className="dark">
            <body className="font-sans antialiased">{children}</body>
        </html>
    );
}

"use client";

import Link from "next/link";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Send,
    Inbox,
    AlertCircle,
    Key,
    ArrowLeft,
    BarChart3,
    MessageCircle,
    Mic,
    ChevronDown,
    Mail,
    UserMinus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const emailSidebarItems = [
    {
        title: "Dashboard",
        href: "/dashboard/email",
        icon: LayoutDashboard,
    },

    {
        title: "Sent",
        href: "/dashboard/email/sent",
        icon: Send,
    },
    {
        title: "Received",
        href: "/dashboard/email/received",
        icon: Inbox,
    },
    {
        title: "Bounces",
        href: "/dashboard/email/bounces",
        icon: AlertCircle,
    },
    {
        title: "Unsubscribed",
        href: "/dashboard/email/unsubscribed",
        icon: UserMinus,
    },
    {
        title: "Analytics",
        href: "/dashboard/email/analytics",
        icon: BarChart3,
    },
    
];

export default function EmailLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="flex h-screen overflow-hidden bg-[#0a0d14] text-[var(--label-primary)] relative">
            {/* Ambient Light Orbs */}
            <div className="fixed -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none z-0" />
            <div className="fixed -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[120px] pointer-events-none z-0" />

            {/* Email Sidebar */}
            <aside className="w-64 flex-col bg-[rgba(18,24,41,0.55)] backdrop-blur-[25px] saturate-[180%] border-r border-[rgba(255,255,255,0.1)] hidden md:flex font-sans z-10">
                <div className="p-6 pb-4 flex justify-center">
                    <div className="relative w-48 h-16">
                        <Image
                            src="/nh-final-white.webp"
                            alt="Naples Homes Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                </div>

                <div className="px-4 pb-2">
                    {mounted ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between bg-[rgba(255,255,255,0.05)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.15)] text-[var(--label-primary)] hover:bg-[rgba(255,255,255,0.1)] h-10 shadow-sm rounded-xl"
                                >
                                    <span className="flex items-center gap-2">
                                        <LayoutDashboard className="h-4 w-4 text-blue-400" />
                                        <span>Switch Dashboard</span>
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[220px]" side="top">
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard" className="cursor-pointer w-full flex items-center">
                                        <LayoutDashboard className="mr-2 h-4 w-4" /> Master Overview
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/email" className="cursor-pointer w-full flex items-center">
                                        <Mail className="mr-2 h-4 w-4" /> Email Marketing
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/whatsapp" className="cursor-pointer w-full flex items-center">
                                        <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp CRM
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/voice" className="cursor-pointer w-full flex items-center">
                                        <Mic className="mr-2 h-4 w-4" /> Voice Agent
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full justify-between bg-[rgba(255,255,255,0.05)] backdrop-blur-[20px] border border-[rgba(255,255,255,0.15)] text-[var(--label-primary)] h-10 shadow-sm rounded-xl opacity-50"
                        >
                            <span className="flex items-center gap-2">
                                <LayoutDashboard className="h-4 w-4" />
                                <span>Loading...</span>
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50" />
                        </Button>
                    )}
                </div>

                <div className="px-4 py-2">
                    <div className="h-[1px] w-full bg-[rgba(255,255,255,0.1)]"></div>
                </div>

                <nav className="flex-1 overflow-auto px-4 space-y-2">
                    {emailSidebarItems.map((item, index) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                className={`group flex items-center gap-4 rounded-full px-4 py-3 text-sm font-medium transition-all duration-300 ${isActive
                                    ? "active-liquid-pill"
                                    : "text-slate-300 hover:text-white nav-item-glass"
                                    }`}
                            >
                                <item.icon className={`h-5 w-5 ${isActive ? "text-blue-300" : "text-slate-400 group-hover:text-slate-200 transition-colors"}`} />
                                {item.title}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto p-4 mb-4">
                </div>
            </aside>

            <main className="flex-1 overflow-auto bg-[#0a0d14] p-6 relative z-10">
                {children}
            </main>
        </div>
    );
}

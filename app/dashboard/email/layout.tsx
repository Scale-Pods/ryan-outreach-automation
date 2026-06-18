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
        <div className="flex h-screen overflow-hidden bg-zinc-50 text-slate-900">
            <aside className="w-64 flex-col bg-white border-r border-zinc-200 hidden md:flex font-sans">
                <div className="p-6 pb-4 flex justify-center">
                    <div className="relative w-48 h-16">
                        <Image
                            src="https://lotusmanor.ae/logoheader.webp"
                            alt="Lotus Manor Logo"
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
                                    className="w-full justify-between bg-white border-slate-200 text-slate-700 hover:bg-slate-50 h-10 shadow-sm"
                                >
                                    <span className="flex items-center gap-2">
                                        <LayoutDashboard className="h-4 w-4 text-blue-600" />
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
                            className="w-full justify-between bg-white border-slate-200 text-slate-700 h-10 shadow-sm opacity-50"
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
                    <div className="h-[1px] w-full bg-zinc-100"></div>
                </div>

                <nav className="flex-1 overflow-auto px-4 space-y-2">
                    {emailSidebarItems.map((item, index) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                className={`group flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all ${isActive
                                    ? "bg-gradient-to-r from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20"
                                    : "text-slate-500 hover:text-slate-900 hover:bg-zinc-100"
                                    }`}
                            >
                                <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600 transition-colors"}`} />
                                {item.title}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto p-4 mb-4">
                    {/* Switcher moved to top */}
                </div>
            </aside>

            <main className="flex-1 overflow-auto bg-zinc-50 p-6">
                {children}
            </main>
        </div>
    );
}

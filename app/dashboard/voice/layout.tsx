"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Phone,
    BarChart3,
    ArrowLeft,
    Mail,
    MessageCircle,
    Mic,
    ChevronDown,
    Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const voiceSidebarItems = [
    {
        title: "Dashboard",
        href: "/dashboard/voice",
        icon: LayoutDashboard,
    },
    {
        title: "Call Logs",
        href: "/dashboard/voice/logs",
        icon: Phone,
    },
    {
        title: "Analytics",
        href: "/dashboard/voice/analytics",
        icon: BarChart3,
    },
    {
        title: "Cost Calculator",
        href: "/dashboard/voice/calculator",
        icon: Activity,
    },
];

export default function VoiceLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className="flex h-screen overflow-hidden bg-[var(--bg-app)] text-[var(--label-primary)]">
            <aside className="w-64 flex-col bg-[var(--glass-fill)] backdrop-blur-[48px] shadow-[var(--glass-shadow)] border-r border-[var(--separator)] hidden md:flex font-sans">
                <div className="p-6 pb-4 flex justify-center">
                    <div className="relative w-48 h-16">
                        <Image
                            src="https://www.napleshomes.com/inc/skins/custom/img/nh-final-white.png"
                            alt="Naples Homes Logo"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                </div>

                <div className="px-4 pb-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-full justify-between bg-[var(--glass-fill)] backdrop-blur-[48px] border-[var(--separator)] text-[var(--label-primary)] hover:bg-[var(--glass-fill-hover)] h-10 shadow-[var(--glass-shadow)]"
                            >
                                <span className="flex items-center gap-2">
                                    <LayoutDashboard className="h-4 w-4 text-purple-600" />
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
                </div>

                <div className="px-4 py-2">
                    <div className="h-[1px] w-full bg-[var(--separator)]"></div>
                </div>

                <nav className="flex-1 overflow-auto px-4 space-y-2">
                    {voiceSidebarItems.map((item, index) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                className={`group flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all ${isActive
                                    ? "bg-[var(--blue)] text-white shadow-[var(--glass-shadow)]"
                                    : "text-[var(--label-secondary)] hover:text-[var(--label-primary)] hover:bg-[var(--glass-fill-hover)]"
                                    }`}
                            >
                                <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-[var(--label-tertiary)] group-hover:text-[var(--label-secondary)] transition-colors"}`} />
                                {item.title}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto p-4 mb-4">
                    {/* Switcher moved to top */}
                </div>
            </aside>

            <main className="flex-1 overflow-auto bg-[var(--bg-app)] p-6">
                {children}
            </main>
        </div>
    );
}

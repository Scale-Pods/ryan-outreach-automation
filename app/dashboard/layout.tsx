"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Mail, MessageCircle, Mic, LogOut, ChevronDown, Wallet, BarChart2, Users, Send, Key, ExternalLink, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataProvider, useData } from "@/context/DataContext";
import { calculateDuration } from "@/lib/utils";
import { useMemo } from "react";
import { logout } from "@/app/actions/auth";

const sidebarItems = [
    {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Email Marketing",
        href: "/dashboard/email",
        icon: Mail,
    },
    {
        title: "WhatsApp",
        href: "/dashboard/whatsapp",
        icon: MessageCircle,
    },
    {
        title: "Voice Agent",
        href: "/dashboard/voice",
        icon: Mic,
    },
];

function WalletModal({ isOpen, onClose, type, details, calls }: { isOpen: boolean, onClose: () => void, type: 'vapi' | 'twilio', details?: any, calls?: any[] }) {
    const { voiceBalance } = useData();

    const title = (() => {
        switch (type) {
            case 'vapi': return 'Vapi Wallet';
            case 'twilio': return 'Twilio Account';
            default: return 'Balance Detail';
        }
    })();

    const icon = (() => {
        switch (type) {
            case 'vapi': return <Mic className="h-5 w-5 text-blue-600" />;
            case 'twilio': return <Smartphone className="h-5 w-5 text-rose-600" />;
            default: return <Wallet className="h-5 w-5" />;
        }
    })();

    const vapiAgentUsed = useMemo(() => {
        if (!calls || !Array.isArray(calls)) return 0;
        // Strictly sum 'agent' costs from the logs displayed in the current range
        return calls.filter((c: any) => c.source === 'vapi').reduce((acc: number, call: any) => acc + (call.breakdown?.agent || 0), 0);
    }, [calls]);

    const vapiDetails = voiceBalance?.vapi;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {icon}
                        <span>{title}</span>
                    </DialogTitle>
                </DialogHeader>
                <div className="py-2 space-y-6">
                    {type === 'vapi' && (
                        <div className="bg-blue-50/50 rounded-xl p-6 border border-blue-100 flex flex-col gap-4">
                            <div className="flex flex-col text-center bg-[var(--glass-fill)] backdrop-blur-[48px] shadow-[var(--glass-shadow)] p-8 rounded-lg border border-[var(--separator)]">
                                <span className="text-sm font-bold text-[var(--label-secondary)] uppercase tracking-[0.2em] mb-2">Vapi Credits Used</span>
                                <span className="text-5xl font-black text-blue-600">
                                    ${vapiAgentUsed.toFixed(2)}
                                </span>
                                
                            </div>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-12" onClick={() => window.open('https://vapi.ai', '_blank')}>
                                <ExternalLink className="h-4 w-4" /> Add Funds to VAPI
                            </Button>
                        </div>
                    )}

                    {type === 'twilio' && (
                        <div className="bg-rose-50/50 rounded-xl p-5 border border-rose-100 flex flex-col gap-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex flex-col text-center bg-[var(--glass-fill)] backdrop-blur-[48px] shadow-[var(--glass-shadow)] p-6 rounded-lg border border-[var(--separator)]">
                                    <span className="text-xs font-semibold text-[var(--label-secondary)] uppercase tracking-wider mb-1">Remaining Balance</span>
                                    <span className="text-4xl font-black text-rose-600">
                                        {typeof details?.balance === 'number' ? `$${details.balance.toFixed(2)}` : "---"}
                                    </span>
                                    <span className="text-[10px] text-[var(--label-tertiary)] mt-2 font-mono uppercase">{details?.account_sid || "Account SID Loading..."}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col text-center bg-[var(--glass-fill)] backdrop-blur-[48px] shadow-[var(--glass-shadow)] p-3 rounded-lg border border-[var(--separator)]">
                                        <span className="text-[10px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider mb-1">Total Pay-As-You-Go</span>
                                        <span className="text-lg font-bold text-[var(--label-primary)]">
                                            {typeof details?.total_recharge === 'number' ? `$${details.total_recharge.toFixed(2)}` : "---"}
                                        </span>
                                    </div>
                                    <div className="flex flex-col text-center bg-[var(--glass-fill)] backdrop-blur-[48px] shadow-[var(--glass-shadow)] p-3 rounded-lg border border-[var(--separator)]">
                                        <span className="text-[10px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider mb-1">Used to Date</span>
                                        <span className="text-lg font-bold text-[var(--label-secondary)]">
                                            {typeof details?.used === 'number' ? `$${details.used.toFixed(2)}` : "---"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button className="bg-rose-600 hover:bg-rose-700 text-white gap-2" onClick={() => window.open('https://console.twilio.com', '_blank')}>
                                <ExternalLink className="h-4 w-4" /> Add Funds to Twilio 
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DataProvider>
            <DashboardContent>
                {children}
            </DashboardContent>
        </DataProvider>
    );
}

function DashboardContent({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const dashboardConfig = {
        master: {
            label: "Master Overview",
            icon: LayoutDashboard,
            items: [
                { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
                { title: "Email Marketing", href: "/dashboard/email", icon: Mail },
                { title: "WhatsApp CRM", href: "/dashboard/whatsapp", icon: MessageCircle },
                { title: "Voice Agent", href: "/dashboard/voice", icon: Mic },
                { title: "Leads", href: "/dashboard/leads", icon: Users },
                { title: "Credentials", href: "/dashboard/credentials", icon: Key },
            ]
        },
        email: {
            label: "Email Marketing",
            icon: Mail,
            items: [
                { title: "Overview", href: "/dashboard/email", icon: LayoutDashboard },
                { title: "Analytics", href: "/dashboard/email/analytics", icon: BarChart2 },
            ]
        },
        whatsapp: {
            label: "WhatsApp CRM",
            icon: MessageCircle,
            items: [
                { title: "Overview", href: "/dashboard/whatsapp", icon: LayoutDashboard },
                { title: "Leads", href: "/dashboard/whatsapp/leads", icon: Users },
                { title: "Sent Messages", href: "/dashboard/whatsapp/sent", icon: Send },
            ]
        },
        voice: {
            label: "Voice Agent",
            icon: Mic,
            items: [
                { title: "Overview", href: "/dashboard/voice", icon: LayoutDashboard },
                { title: "Call Logs", href: "/dashboard/voice/logs", icon: Mic },
            ]
        }
    };

    // Determine current context
    let currentContext = "master";
    if (pathname.startsWith("/dashboard/email")) currentContext = "email";
    else if (pathname.startsWith("/dashboard/whatsapp")) currentContext = "whatsapp";
    else if (pathname.startsWith("/dashboard/voice")) currentContext = "voice";

    const activeConfig = (dashboardConfig as any)[currentContext];

    const {
        calls,
        voiceBalance,
        twilioBalance,
        loadingBalances,
        loadingCalls
    } = useData();
    const vapiAgentUsed = useMemo(() => {
        // Prioritize Vapi API's native 'used' value if available
        if (voiceBalance?.vapi?.used !== undefined && voiceBalance?.vapi?.used !== 0) {
            return voiceBalance.vapi.used;
        }
        if (!calls || !Array.isArray(calls)) return 0;
        // Fallback to summing 'agent' costs from logs specifically
        return calls.filter((c: any) => c.source === 'vapi').reduce((acc: number, call: any) => acc + (call.breakdown?.agent || 0), 0);
    }, [calls, voiceBalance]);

    const [walletModal, setWalletModal] = useState<{ isOpen: boolean, type: 'vapi' | 'twilio' }>({
        isOpen: false,
        type: 'vapi'
    });


    const content = (() => {
        if (pathname.startsWith("/dashboard/email") || pathname.startsWith("/dashboard/whatsapp") || pathname.startsWith("/dashboard/voice")) {
            return <>{children}</>;
        }

        return (
            <div className="flex h-screen overflow-hidden bg-[var(--bg-app)] text-[var(--label-primary)]">
                {/* Sidebar */}
                <aside className="hidden w-64 flex-col bg-[var(--glass-fill)] backdrop-blur-[48px] shadow-[var(--glass-shadow)] border-r border-[var(--separator)] md:flex font-sans">
                    {/* Logo Section */}
                    <div className="p-6 pb-4 flex justify-center">
                        <Link href="/" className="relative w-48 h-16 block">
                            <Image
                                src="https://www.napleshomes.com/inc/skins/custom/img/nh-final-white.png"
                                alt="Naples Homes Logo"
                                fill
                                className="object-contain"
                                priority
                            />
                        </Link>
                    </div>

                    <div className="px-4 pb-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    suppressHydrationWarning
                                    variant="outline"
                                    className="w-full justify-between bg-[var(--glass-fill)] backdrop-blur-[48px] border-[var(--separator)] text-[var(--label-primary)] hover:bg-[var(--glass-fill-hover)] h-10 shadow-[var(--glass-shadow)]"
                                >
                                    <span className="flex items-center gap-2">
                                        <activeConfig.icon className="h-4 w-4 text-blue-600" />
                                        <span className="truncate">{activeConfig.label}</span>
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[220px]">
                                <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                                    <LayoutDashboard className="mr-2 h-4 w-4" /> Master Overview
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push("/dashboard/email")}>
                                    <Mail className="mr-2 h-4 w-4" /> Email Marketing
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push("/dashboard/whatsapp")}>
                                    <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp CRM
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push("/dashboard/voice")}>
                                    <Mic className="mr-2 h-4 w-4" /> Voice Agent
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="px-4 py-2">
                        <div className="h-[1px] w-full bg-[var(--separator)]"></div>
                    </div>

                    <nav className="flex-1 overflow-auto px-4 space-y-2">
                        {activeConfig.items.map((item: any, index: number) => {
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
                    <div className="mt-auto p-4 mb-4 space-y-3">
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 text-[var(--label-secondary)] hover:text-[var(--label-primary)] hover:bg-[var(--glass-fill-hover)]"
                            onClick={async () => {
                                await logout();
                                router.push('/');
                                router.refresh();
                            }}
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </Button>
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    <header className="flex h-14 items-center gap-4 border-b border-[var(--separator)] bg-[var(--bg-layer1)]/80 backdrop-blur-[40px] px-6 lg:h-[60px]">
                        <div className="flex flex-1 items-center justify-between">
                            <h1 className="text-lg font-semibold text-[var(--label-primary)] flex items-center">
                                {pathname === "/dashboard" ? "" : (activeConfig.items.find((item: any) => item.href === pathname)?.title || activeConfig.label)}
                                {currentContext === "master" && (
                                    <span style={{ fontSize: 10, background: "rgba(0, 122, 255, 0.08)", color: "var(--blue)", border: "1px solid rgba(0, 122, 255, 0.15)", padding: "2px 8px", borderRadius: 12, fontWeight: 600, marginLeft: 8 }}>Powered by ScalePods</span>
                                )}
                            </h1>

                            {currentContext === "master" && (
                                <div className="flex items-center gap-2">
                                    {/* Vapi Balance Button */}
                                    <Button
                                        variant="outline"
                                        className="h-10 px-3 border-blue-200 bg-[var(--glass-fill)] backdrop-blur-[48px] hover:bg-[var(--glass-fill-hover)] text-blue-700 gap-2 flex items-center shadow-[var(--glass-shadow)]"
                                        onClick={() => setWalletModal({ isOpen: true, type: 'vapi' })}
                                    >
                                        <Mic className="h-3.5 w-3.5" />
                                        <div className="flex flex-col items-start leading-[1.1]">
                                            <span className="text-[9px] font-bold uppercase opacity-70">Vapi Used</span>
                                            <span className="text-xs font-bold">
                                                {loadingCalls ? "..." : `$${vapiAgentUsed.toFixed(2)}`}
                                            </span>
                                        </div>
                                    </Button>

                                    {/* Twilio Button */}
                                    <Button
                                        variant="outline"
                                        className="h-10 px-3 border-rose-200 bg-[var(--glass-fill)] backdrop-blur-[48px] hover:bg-[var(--glass-fill-hover)] text-rose-700 gap-2 flex items-center shadow-[var(--glass-shadow)]"
                                        onClick={() => setWalletModal({ isOpen: true, type: 'twilio' })}
                                    >
                                        <Smartphone className="h-3.5 w-3.5" />
                                        <div className="flex flex-col items-start leading-[1.1]">
                                            <span className="text-[9px] font-bold uppercase opacity-70">Twilio</span>
                                            <span className="text-xs font-bold">
                                                {loadingBalances ? "..." : (twilioBalance?.balance !== undefined ? `$${twilioBalance.balance.toFixed(2)}` : "N/A")}
                                            </span>
                                        </div>
                                    </Button>

                                </div>
                            )}
                        </div>
                    </header>

                    <WalletModal
                        isOpen={walletModal.isOpen}
                        type={walletModal.type}
                        details={(() => {
                            switch (walletModal.type) {
                                case 'vapi': return voiceBalance?.vapi;
                                case 'twilio': return twilioBalance;
                                default: return null;
                            }
                        })()}
                        calls={calls}
                        onClose={() => setWalletModal({ ...walletModal, isOpen: false })}
                    />

                    <main className="flex-1 overflow-auto bg-[var(--bg-app)] p-6 relative">
                        {children}
                    </main>
                </div>
            </div>
        );
    })();

    return (
        <>{content}</>
    );
}

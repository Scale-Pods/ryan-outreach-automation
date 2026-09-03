"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    RefreshCw,
    Send,
    MessageSquare,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Clock,
    AlertCircle
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SMSChatDetail } from "@/components/dashboard/sms-chat-detail";
import { LMLoader } from "@/components/ryan-loader";
import { FollowUpBossButton } from "@/components/ui/followup-boss-button";

interface SentSMSItem {
    id: string;
    lead_name: string;
    lead_phone: string;
    lead_email: string;
    content: string;
    status: string;
    created_at: string;
}

function getSmsStatusBadge(statusRaw?: string) {
    if (!statusRaw || !String(statusRaw).trim()) {
        return <Badge variant="outline" className="text-[10px] text-slate-400 border-white/10 uppercase font-bold">SENT</Badge>;
    }
    const s = String(statusRaw).trim().toLowerCase();
    if (s === 'delivered' || s === 'completed') {
        return (
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase gap-1">
                <CheckCircle2 className="h-3 w-3" /> DELIVERED
            </Badge>
        );
    }
    if (s === 'failed' || s === 'error' || s === 'undelivered') {
        return (
            <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase gap-1">
                <AlertCircle className="h-3 w-3" /> FAILED
            </Badge>
        );
    }
    if (s === 'replied' || s === 'reply') {
        return (
            <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase gap-1">
                <MessageSquare className="h-3 w-3" /> REPLIED
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="text-[10px] text-sky-400 border-sky-500/30 bg-sky-500/10 uppercase font-bold">
            {s.toUpperCase()}
        </Badge>
    );
}

export default function SmsSentPage() {
    const [sentMessages, setSentMessages] = useState<SentSMSItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLeadIdForChat, setSelectedLeadIdForChat] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 90),
        to: new Date(),
    });

    const fetchSentMessages = useCallback(async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const fromISO = startOfDay(from).toISOString();
            const toISO = endOfDay(to).toISOString();
            const res = await fetch(`/api/sms-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const activities: SentSMSItem[] = (data.sms_activity || []).map((a: any, idx: number) => ({
                id: a.id || `sent-${idx}`,
                lead_name: a.lead_name || a.name || "SMS Contact",
                lead_phone: a.lead_phone || a.phone || "—",
                lead_email: a.lead_email || a.email || "",
                content: a.content || a.note || "Outbound SMS dispatched",
                status: a.status || (a.action_type === 'reply' ? 'replied' : 'delivered'),
                created_at: a.created_at || a.created_date || new Date().toISOString(),
            }));
            setSentMessages(activities);
        } catch (err) {
            console.error('[SmsSentPage] error:', err);
            setSentMessages([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchSentMessages(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchSentMessages]);

    const filteredSent = useMemo(() => {
        return sentMessages.filter(item => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
                item.lead_name.toLowerCase().includes(q) ||
                item.lead_phone.toLowerCase().includes(q) ||
                item.content.toLowerCase().includes(q)
            );
        });
    }, [sentMessages, searchQuery]);

    const totalPages = Math.ceil(filteredSent.length / itemsPerPage) || 1;
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredSent.slice(start, start + itemsPerPage);
    }, [filteredSent, currentPage]);

    return (
        <div className="space-y-6 pb-6 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--label-primary)] tracking-tight flex items-center gap-2">
                        <Send className="h-6 w-6 text-blue-400" />
                        SMS Messages
                    </h1>
                    <p className="text-[var(--label-secondary)] text-sm">Detailed outbound SMS execution and carrier delivery logs</p>
                </div>
                <DateRangePicker onUpdate={(range) => setDateRange(range.range)} />
            </div>

            {/* Search Bar */}
            <div className="flex items-center justify-between gap-4 bg-[var(--glass-fill)] backdrop-blur-[24px] p-4 rounded-2xl border border-[var(--separator)] shadow-lg">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search sent messages by recipient, phone, or content snippet..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="pl-10 bg-slate-950/40 border-white/10 text-white rounded-xl h-10 placeholder:text-slate-500"
                    />
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => fetchSentMessages(dateRange.from, dateRange.to || dateRange.from)}
                    className="text-slate-300 hover:bg-white/10 rounded-xl h-10 w-10"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            {/* Table */}
            <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/[0.03] text-slate-400 text-xs uppercase tracking-wider font-semibold">
                                    <th className="py-3.5 px-4">Recipient</th>
                                    <th className="py-3.5 px-4">Phone Number</th>
                                    <th className="py-3.5 px-4">Message Snippet</th>
                                    <th className="py-3.5 px-4">Delivery Status</th>
                                    <th className="py-3.5 px-4">Sent Time</th>
                                    <th className="py-3.5 px-4 text-center">FUB</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-200">
                                {paginatedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                                            No sent SMS records found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((item, idx) => (
                                        <tr
                                            key={idx}
                                            onClick={() => setSelectedLeadIdForChat(item.lead_phone || item.id)}
                                            className="cursor-pointer hover:bg-white/[0.06] transition-colors"
                                        >
                                            <td className="py-3.5 px-4 font-semibold text-white">
                                                {item.lead_name}
                                            </td>
                                            <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                                                {item.lead_phone}
                                            </td>
                                            <td className="py-3.5 px-4 max-w-md truncate text-xs text-slate-300">
                                                {item.content}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {getSmsStatusBadge(item.status)}
                                            </td>
                                            <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                                                {new Date(item.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </td>
                                            <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                <FollowUpBossButton lead={item} variant="icon" />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-white/[0.02]">
                        <span className="text-xs text-slate-400">
                            Showing page <span className="font-semibold text-white">{currentPage}</span> of{" "}
                            <span className="font-semibold text-white">{totalPages}</span> ({filteredSent.length} total sent messages)
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-8 w-8 p-0 border-white/10 text-slate-300 hover:bg-white/10"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="h-8 w-8 p-0 border-white/10 text-slate-300 hover:bg-white/10"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Chat Thread Dialog */}
            <Dialog open={!!selectedLeadIdForChat} onOpenChange={(open) => !open && setSelectedLeadIdForChat(null)}>
                <DialogContent className="max-w-3xl h-[85vh] p-0 bg-transparent border-none">
                    <DialogHeader className="sr-only">
                        <DialogTitle>SMS Chat Detail</DialogTitle>
                    </DialogHeader>
                    {selectedLeadIdForChat && (
                        <SMSChatDetail
                            customerId={selectedLeadIdForChat}
                            onClose={() => setSelectedLeadIdForChat(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

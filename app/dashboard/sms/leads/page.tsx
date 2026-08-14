"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    Briefcase,
    RefreshCw,
    Users,
    MessageSquare,
    Smartphone,
    Send
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { subDays, startOfDay, endOfDay } from "date-fns";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { SMSChatDetail } from "@/components/dashboard/sms-chat-detail";
import { LMLoader } from "@/components/ryan-loader";

interface SMSLead {
    "Lead ID"?: string;
    "Name"?: string;
    "Phone"?: string;
    "Email"?: string;
    "Created At"?: string;
    source_loop?: string;
    status?: string;
    lead_temp?: string;
    created_at?: string;
    [key: string]: any;
}

function getStatusBadge(statusRaw?: string) {
    if (!statusRaw || !String(statusRaw).trim()) {
        return <span className="text-[var(--label-tertiary)] text-xs">—</span>;
    }
    const s = String(statusRaw).trim().toLowerCase();
    if (s === 'delivered') {
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold uppercase">DELIVERED</Badge>;
    }
    if (s === 'sent') {
        return <Badge variant="outline" className="text-[10px] text-sky-600 border-sky-200 bg-sky-50 font-bold uppercase">SENT</Badge>;
    }
    if (s === 'replied') {
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold uppercase">REPLIED</Badge>;
    }
    if (s === 'failed' || s === 'error') {
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none text-[10px] font-bold uppercase">FAILED</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] text-[var(--label-secondary)] border-[var(--separator)] uppercase font-bold">{s}</Badge>;
}

function getTemperatureBadge(tempRaw?: string) {
    if (!tempRaw || !String(tempRaw).trim()) {
        return <span className="text-[var(--label-tertiary)] text-xs">—</span>;
    }
    const t = String(tempRaw).trim().toLowerCase();
    if (t === 'hot' || t === 'fire') {
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none text-[10px] font-bold uppercase">HOT 🔥</Badge>;
    }
    if (t === 'warm') {
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none text-[10px] font-bold uppercase">WARM ☀️</Badge>;
    }
    if (t === 'cold') {
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none text-[10px] font-bold uppercase">COLD ❄️</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] text-[var(--label-secondary)] border-[var(--separator)] uppercase font-bold">{tempRaw}</Badge>;
}

export default function SmsLeadsPage() {
    const [smsLeads, setSmsLeads] = useState<SMSLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLeadIdForChat, setSelectedLeadIdForChat] = useState<string | null>(null);
    const [selectedLeadObj, setSelectedLeadObj] = useState<SMSLead | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 10;

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 90),
        to: new Date(),
    });

    const [activeFilters, setActiveFilters] = useState<{
        replyStatus: string[];
        loops: string[];
    }>({ replyStatus: [], loops: [] });

    const fetchSmsData = useCallback(async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const fromISO = startOfDay(from).toISOString();
            const toISO = endOfDay(to).toISOString();
            const res = await fetch(`/api/sms-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const activities: SMSLead[] = (data.sms_activity || []).map((a: any) => ({
                ...a,
                "Lead ID": a.lead_id || a.id || a.lead_phone || a.phone,
                "Name": a.lead_name || a.name || "SMS Lead",
                "Phone": a.lead_phone || a.phone || "",
                "Email": a.lead_email || a.email || "",
                source_loop: a.campaign || a.source_loop || "SMS Campaign",
                status: a.status || (a.action_type === 'reply' ? 'replied' : 'delivered'),
                lead_temp: a.lead_temp || a.sentiment || "warm",
                created_at: a.created_at || a.created_date,
            }));
            const leads: SMSLead[] = (data.sms_leads || []).map((l: any) => ({
                ...l,
                source_loop: l.source_loop || "SMS Campaign",
                status: l.status || "delivered",
                lead_temp: l.lead_temp || "warm",
            }));

            // Deduplicate leads by phone number
            const leadMap = new Map<string, SMSLead>();
            [...activities, ...leads].forEach(lead => {
                const phone = lead["Phone"] || lead["Lead ID"];
                if (phone && !leadMap.has(phone)) {
                    leadMap.set(phone, lead);
                }
            });

            setSmsLeads(Array.from(leadMap.values()));
        } catch (err) {
            console.error('[SmsLeadsPage] fetch error:', err);
            setSmsLeads([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchSmsData(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchSmsData]);

    const toggleFilter = useCallback((category: 'replyStatus' | 'loops', value: string) => {
        setActiveFilters(prev => {
            const current = prev[category];
            const updated = current.includes(value)
                ? current.filter(v => v !== value)
                : [...current, value];
            return { ...prev, [category]: updated };
        });
    }, []);

    // Filter leads
    const filteredLeads = useMemo(() => {
        return smsLeads.filter(lead => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const nameMatch = (lead["Name"] || "").toLowerCase().includes(q);
                const phoneMatch = (lead["Phone"] || "").toLowerCase().includes(q);
                const emailMatch = (lead["Email"] || "").toLowerCase().includes(q);
                if (!nameMatch && !phoneMatch && !emailMatch) return false;
            }

            if (activeFilters.replyStatus.length > 0) {
                const hasReplied = lead.status === 'replied' || lead.action_type === 'reply';
                const matchesReplied = activeFilters.replyStatus.includes('replied') && hasReplied;
                const matchesNoReply = activeFilters.replyStatus.includes('no_reply') && !hasReplied;
                if (!matchesReplied && !matchesNoReply) return false;
            }

            if (activeFilters.loops.length > 0) {
                if (!activeFilters.loops.includes(lead.source_loop || "")) return false;
            }

            return true;
        });
    }, [smsLeads, searchQuery, activeFilters]);

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage) || 1;
    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * leadsPerPage;
        return filteredLeads.slice(start, start + leadsPerPage);
    }, [filteredLeads, currentPage]);

    const toggleSelectAll = () => {
        if (selectedLeads.length === paginatedLeads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(paginatedLeads.map(l => l["Lead ID"] || l["Phone"] || Math.random().toString()));
        }
    };

    const toggleSelectLead = (id: string) => {
        setSelectedLeads(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    return (
        <div className="space-y-6 pb-6 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--label-primary)] tracking-tight flex items-center gap-2">
                        <Users className="h-6 w-6 text-amber-400" />
                        SMS Leads Directory
                    </h1>
                    <p className="text-[var(--label-secondary)] text-sm">View and manage SMS contacts and thread conversation history</p>
                </div>
                <DateRangePicker onUpdate={(range) => setDateRange(range.range)} />
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--glass-fill)] backdrop-blur-[24px] p-4 rounded-2xl border border-[var(--separator)] shadow-lg">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search SMS leads by name, phone, or email..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        className="pl-10 bg-slate-950/40 border-white/10 text-white rounded-xl h-10 placeholder:text-slate-500"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="gap-2 bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 rounded-xl h-10 text-xs">
                                <Filter className="h-4 w-4 text-amber-400" /> Filter
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px] bg-[#0f172a] border-white/15 text-white">
                            <DropdownMenuItem onClick={() => toggleFilter('replyStatus', 'replied')} className="cursor-pointer text-xs">
                                {activeFilters.replyStatus.includes('replied') ? '✓ ' : ''} Show Replied
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleFilter('replyStatus', 'no_reply')} className="cursor-pointer text-xs">
                                {activeFilters.replyStatus.includes('no_reply') ? '✓ ' : ''} Show No Reply
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => fetchSmsData(dateRange.from, dateRange.to || dateRange.from)}
                        className="text-slate-300 hover:bg-white/10 rounded-xl h-10 w-10"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Leads Table Card */}
            <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-xl overflow-hidden">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/[0.03] text-slate-400 text-xs uppercase tracking-wider font-semibold">
                                    <th className="py-3.5 px-4 w-12 text-center">
                                        <Checkbox checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0} onCheckedChange={toggleSelectAll} />
                                    </th>
                                    <th className="py-3.5 px-4">Contact</th>
                                    <th className="py-3.5 px-4">Phone Number</th>
                                    <th className="py-3.5 px-4">Campaign Loop</th>
                                    <th className="py-3.5 px-4">Status</th>
                                    <th className="py-3.5 px-4">Interest</th>
                                    <th className="py-3.5 px-4">Last Activity</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-200">
                                {paginatedLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">
                                            No SMS leads found matching the criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedLeads.map((lead, idx) => {
                                        const leadId = lead["Lead ID"] || lead["Phone"] || `lead-${idx}`;
                                        const isSelected = selectedLeads.includes(leadId);
                                        return (
                                            <tr
                                                key={idx}
                                                onClick={() => {
                                                    setSelectedLeadIdForChat(leadId);
                                                    setSelectedLeadObj(lead);
                                                }}
                                                className="cursor-pointer hover:bg-white/[0.06] transition-colors group"
                                            >
                                                <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectLead(leadId)} />
                                                </td>
                                                <td className="py-3.5 px-4 font-semibold text-white">
                                                    {lead["Name"] || "SMS Lead"}
                                                </td>
                                                <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                                                    {lead["Phone"] || "—"}
                                                </td>
                                                <td className="py-3.5 px-4 text-xs text-slate-400">
                                                    <span className="flex items-center gap-1.5">
                                                        <Briefcase className="h-3.5 w-3.5 text-amber-400" />
                                                        {lead.source_loop || "SMS Campaign"}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    {getStatusBadge(lead.status)}
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    {getTemperatureBadge(lead.lead_temp)}
                                                </td>
                                                <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                                                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "Recent"}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-white/[0.02]">
                        <span className="text-xs text-slate-400">
                            Showing <span className="font-semibold text-white">{filteredLeads.length > 0 ? (currentPage - 1) * leadsPerPage + 1 : 0}</span> to{" "}
                            <span className="font-semibold text-white">{Math.min(currentPage * leadsPerPage, filteredLeads.length)}</span> of{" "}
                            <span className="font-semibold text-white">{filteredLeads.length}</span> leads
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
                            <span className="text-xs text-slate-400 font-mono px-2">Page {currentPage} of {totalPages}</span>
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
                    {selectedLeadIdForChat && (
                        <SMSChatDetail
                            customerId={selectedLeadIdForChat}
                            initialLead={selectedLeadObj}
                            onClose={() => setSelectedLeadIdForChat(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

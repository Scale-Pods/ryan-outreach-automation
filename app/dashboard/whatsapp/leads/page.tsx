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
    Users
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
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import { LMLoader } from "@/components/ryan-loader";

// Raw shape returned by /api/whatsapp-leads
interface WALead {
    "Lead ID"?: string;
    "Name"?: string;
    "Phone"?: string;
    "Email"?: string;
    "Created At"?: string;
    "W.P_1 TS"?: string;
    "WP_Replied_track"?: string;
    "Senders email"?: string;
    source_loop?: string;
    wp1_parsed_date?: string;
    [key: string]: any;
}


// Best available date for a lead row — RPC returns wp1_parsed_date.
function getLeadDate(lead: WALead): Date | null {
    const parsed = lead["wp1_parsed_date"];
    if (parsed) { const d = new Date(parsed); if (!isNaN(d.getTime())) return d; }
    return null;
}

export default function WhatsappLeadsPage() {
    const [waLeads, setWaLeads] = useState<WALead[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLeadIdForChat, setSelectedLeadIdForChat] = useState<string | null>(null);
    const [selectedLeadObj, setSelectedLeadObj] = useState<WALead | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 10;

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const [activeFilters, setActiveFilters] = useState<{
        replyStatus: string[];
        loops: string[];
    }>({ replyStatus: [], loops: [] });

    const resetFilters = useCallback(() => {
        setActiveFilters({ replyStatus: [], loops: [] });
        setSearchQuery("");
    }, []);

    const toggleFilter = useCallback((category: 'replyStatus' | 'loops', value: string) => {
        setActiveFilters(prev => {
            const current = prev[category];
            const updated = current.includes(value)
                ? current.filter(v => v !== value)
                : [...current, value];
            return { ...prev, [category]: updated };
        });
    }, []);

    // Fetch from the dedicated WhatsApp leads endpoint
    const fetchWAData = useCallback(async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const fromISO = startOfDay(from).toISOString();
            const toISO = endOfDay(to).toISOString();
            const res = await fetch(`/api/whatsapp-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            const nr_wf: WALead[] = (data.nr_wf || []).map((l: any) => ({ ...l, source_loop: "Intro" }));
            const followup: WALead[] = (data.followup || []).map((l: any) => ({ ...l, source_loop: "Follow Up" }));
            const nurture: WALead[] = (data.nurture || []).map((l: any) => ({ ...l, source_loop: "Nurture" }));
            setWaLeads([...nr_wf, ...followup, ...nurture]);
        } catch (err) {
            console.error("[WA leads]", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchWAData(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchWAData]);

    const filteredLeads = useMemo(() => {
        setCurrentPage(1);
        return waLeads.filter(lead => {
            const name = String(lead["Name"] || "").toLowerCase();
            const phone = String(lead["Phone"] || "");
            const email = String(lead["Email"] || "").toLowerCase();
            const matchesSearch =
                name.includes(searchQuery.toLowerCase()) ||
                email.includes(searchQuery.toLowerCase()) ||
                phone.includes(searchQuery);
            if (!matchesSearch) return false;

            const wtR = lead["WP_Replied_track"];
            const hasReplied = wtR && wtR !== "" && String(wtR).trim().toLowerCase() !== "no";
            if (activeFilters.replyStatus.length > 0) {
                const ok = (activeFilters.replyStatus.includes("Replied") && hasReplied) ||
                    (activeFilters.replyStatus.includes("Sent") && !hasReplied);
                if (!ok) return false;
            }

            if (activeFilters.loops.length > 0) {
                const loop = String(lead.source_loop || "").toLowerCase();
                const ok = activeFilters.loops.some(f => loop.includes(f.toLowerCase()));
                if (!ok) return false;
            }

            return true;
        });
    }, [waLeads, searchQuery, activeFilters]);

    const toggleSelectAll = useCallback(() => {
        if (selectedLeads.length === filteredLeads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(filteredLeads.map((l: any) => l["Lead ID"] || l.id || l.phone).filter(Boolean));
        }
    }, [selectedLeads, filteredLeads]);

    const toggleSelect = useCallback((id: string) => {
        setSelectedLeads(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }, []);

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);

    const paginatedLeads = filteredLeads.slice(
        (currentPage - 1) * leadsPerPage,
        currentPage * leadsPerPage
    );


    return (
        <div className="space-y-6 pb-10 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--label-primary)]">WhatsApp Leads</h1>
                    <p className="text-[var(--label-secondary)] text-sm">Review leads successfully contacted via WhatsApp</p>
                </div>
                    <div className="flex items-center gap-3">
                    {(activeFilters.replyStatus.length > 0 || activeFilters.loops.length > 0 || searchQuery) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetFilters}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-[rgba(52,199,89,0.08)] px-2"
                        >
                            RESET FILTERS
                        </Button>
                    )}
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-[var(--glass-fill)] p-4 rounded-xl border border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)]">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--label-tertiary)]" />
                    <Input
                        className="pl-10 h-10 bg-[var(--bg-app)]/50 border-[var(--separator)]"
                        placeholder="Search leads..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className={`gap-2 h-10 border-[var(--separator)] ${activeFilters.replyStatus.length > 0 ? 'bg-[rgba(52,199,89,0.08)] border-emerald-200 text-emerald-700' : ''}`}>
                                <Filter className="h-4 w-4" />
                                {activeFilters.replyStatus.length > 0 ? `Status (${activeFilters.replyStatus.length})` : 'Status'}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => toggleFilter('replyStatus', 'Replied')} className="flex items-center justify-between">
                                Replied {activeFilters.replyStatus.includes('Replied') && "✓"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleFilter('replyStatus', 'Sent')} className="flex items-center justify-between">
                                Sent {activeFilters.replyStatus.includes('Sent') && "✓"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className={`gap-2 h-10 border-[var(--separator)] ${activeFilters.loops.length > 0 ? 'bg-purple-50 border-purple-200 text-purple-700' : ''}`}>
                                    <Briefcase className="h-4 w-4" />
                                    {activeFilters.loops.length > 0 ? `Loops (${activeFilters.loops.length})` : 'Loops'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => toggleFilter('loops', 'Intro')} className="flex items-center justify-between">
                                    Intro {activeFilters.loops.includes('Intro') && "✓"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleFilter('loops', 'Follow Up')} className="flex items-center justify-between">
                                    Follow Up {activeFilters.loops.includes('Follow Up') && "✓"}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                    <Button variant="outline" className="gap-2 h-10 border-[var(--separator)]" onClick={() => {
                        if (dateRange?.from) fetchWAData(dateRange.from, dateRange.to || dateRange.from);
                    }}>
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedLeads.length > 0 && (
                <div className="bg-[var(--glass-fill)] border border-emerald-100 p-3 rounded-lg flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)]">
                    <span className="text-sm font-bold text-[var(--label-primary)]">{selectedLeads.length} leads selected</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8 border-[var(--separator)] text-[var(--label-secondary)] hover:text-[var(--label-primary)]">Export Selected</Button>
                    </div>
                </div>
            )}

            {/* Table */}
            <Card className="border-[var(--separator)] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)]">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-[var(--bg-app)] text-[var(--label-secondary)] text-xs font-bold uppercase border-b border-[var(--separator)]">
                                    <th className="px-4 py-4 w-[40px]">
                                        <Checkbox
                                            checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="px-4 py-4">Name</th>
                                    <th className="px-4 py-4">Phone</th>
                                    <th className="px-4 py-4">Loop</th>
                                    <th className="px-4 py-4 text-center">Reply Status</th>
                                    <th className="px-4 py-4">WhatsApp Date</th>
                                    <th className="px-4 py-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--separator)]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-20 text-center text-[var(--label-tertiary)]">
                                            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-500" />
                                            Loading WhatsApp leads...
                                        </td>
                                    </tr>
                                ) : filteredLeads.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-20 text-center text-[var(--label-tertiary)]">
                                            No leads found for this date range.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedLeads.map((lead, index) => {
                                        const id = String(lead["Lead ID"] || index);
                                        const wtR = lead["WP_Replied_track"];
                                        const hasReplied = wtR && wtR !== "" && String(wtR).trim().toLowerCase() !== "no";
                                        const waDate = getLeadDate(lead);
                                        return (
                                            <tr
                                                key={`${id}-${index}`}
                                                className="hover:bg-[var(--bg-app)] transition-colors group cursor-pointer"
                                                onClick={() => { setSelectedLeadIdForChat(id); setSelectedLeadObj(lead); }}
                                            >
                                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={selectedLeads.includes(id)}
                                                        onCheckedChange={() => toggleSelect(id)}
                                                    />
                                                </td>
                                                <td className="px-4 py-4 font-bold text-[var(--label-primary)] group-hover:text-emerald-700">{lead["Name"] || "—"}</td>
                                                <td className="px-4 py-4 text-[var(--label-secondary)] font-mono text-xs">{lead["Phone"] || "—"}</td>
                                                <td className="px-4 py-4">
                                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100 text-[10px] uppercase font-bold">
                                                        {lead.source_loop || "—"}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    {hasReplied
                                                        ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold">REPLIED</Badge>
                                                        : <Badge variant="outline" className="text-[10px] text-[var(--label-tertiary)] border-[var(--separator)]">SENT</Badge>
                                                    }
                                                </td>
                                                <td className="px-4 py-4 text-[var(--label-secondary)] text-xs">
                                                    {waDate ? waDate.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}
                                                </td>
                                                <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-[var(--separator)] bg-[var(--bg-app)]/50 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-[var(--label-secondary)]">
                            Showing <span className="font-bold text-[var(--label-primary)]">{paginatedLeads.length}</span> of <span className="font-bold text-[var(--label-primary)]">{filteredLeads.length}</span> leads
                        </p>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(prev => prev - 1)}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>

                                <div className="flex items-center gap-1 mx-2">
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum: number;
                                        if (totalPages <= 5) pageNum = i + 1;
                                        else if (currentPage <= 3) pageNum = i + 1;
                                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                        else pageNum = currentPage - 2 + i;
                                        return (
                                            <Button
                                                key={pageNum}
                                                variant={currentPage === pageNum ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => setCurrentPage(pageNum)}
                                                className={`h-8 w-8 p-0 ${currentPage === pageNum ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                                            >
                                                {pageNum}
                                            </Button>
                                        );
                                    })}
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(prev => prev + 1)}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Chat Detail Modal */}
            <Dialog open={!!selectedLeadIdForChat} onOpenChange={(open) => { if (!open) { setSelectedLeadIdForChat(null); setSelectedLeadObj(null); } }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0">
                    <DialogHeader className="sr-only">
                        <DialogTitle>WhatsApp Chat Detail</DialogTitle>
                    </DialogHeader>
                    {selectedLeadIdForChat && (
                        <WhatsAppChatDetail
                            customerId={selectedLeadIdForChat}
                            initialLead={selectedLeadObj as any}
                            onClose={() => { setSelectedLeadIdForChat(null); setSelectedLeadObj(null); }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

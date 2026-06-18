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
    Building2,
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
import { LMLoader } from "@/components/lm-loader";

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

interface WAOwner {
    id?: string;
    name?: string;
    contactNo?: string;
    "Whatsapp_1_Date"?: string;
    "Whatsapp_1"?: string;
    "WTS_Reply_Track"?: string;
    whatsapp_1_parsed_date?: string;
    [key: string]: any;
}

// Extract the best available date for an owner row.
// RPC returns a pre-parsed whatsapp_1_parsed_date; fall back to Whatsapp_1_Date.
function getOwnerDate(owner: WAOwner): Date | null {
    const parsed = owner["whatsapp_1_parsed_date"];
    if (parsed) { const d = new Date(parsed); if (!isNaN(d.getTime())) return d; }
    const raw = owner["Whatsapp_1_Date"];
    if (raw) { const d = new Date(raw); if (!isNaN(d.getTime())) return d; }
    return null;
}

// Best available date for a lead row — RPC returns wp1_parsed_date.
function getLeadDate(lead: WALead): Date | null {
    const parsed = lead["wp1_parsed_date"];
    if (parsed) { const d = new Date(parsed); if (!isNaN(d.getTime())) return d; }
    return null;
}

export default function WhatsappLeadsPage() {
    const [waLeads, setWaLeads] = useState<WALead[]>([]);
    const [waOwners, setWaOwners] = useState<WAOwner[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedLeadIdForChat, setSelectedLeadIdForChat] = useState<string | null>(null);
    const [selectedLeadObj, setSelectedLeadObj] = useState<WALead | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 10;
    const [activeTab, setActiveTab] = useState<"leads" | "owners">("leads");

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const [activeFilters, setActiveFilters] = useState<{
        replyStatus: string[];
        loops: string[];
    }>({ replyStatus: [], loops: [] });

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
            setWaOwners(data.owners || []);
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

    const filteredOwners = useMemo(() => {
        setCurrentPage(1);
        return waOwners.filter(owner => {
            const name = String(owner.name || "").toLowerCase();
            const phone = String(owner.contactNo || "");
            const matchesSearch =
                name.includes(searchQuery.toLowerCase()) ||
                phone.includes(searchQuery);
            if (!matchesSearch) return false;

            const wtR = owner["WTS_Reply_Track"];
            const hasReplied = wtR && wtR !== "" && String(wtR).toLowerCase() !== "no";
            if (activeFilters.replyStatus.length > 0) {
                const ok = (activeFilters.replyStatus.includes("Replied") && hasReplied) ||
                    (activeFilters.replyStatus.includes("Sent") && !hasReplied);
                if (!ok) return false;
            }

            return true;
        });
    }, [waOwners, searchQuery, activeFilters]);

    const toggleFilter = (type: 'replyStatus' | 'loops', value: string) => {
        setActiveFilters(prev => {
            const current = prev[type];
            return current.includes(value)
                ? { ...prev, [type]: current.filter(v => v !== value) }
                : { ...prev, [type]: [...current, value] };
        });
    };

    const resetFilters = () => {
        setActiveFilters({ replyStatus: [], loops: [] });
        setSearchQuery("");
    };

    const totalPages = activeTab === "leads"
        ? Math.ceil(filteredLeads.length / leadsPerPage)
        : Math.ceil(filteredOwners.length / leadsPerPage);

    const paginatedLeads = filteredLeads.slice(
        (currentPage - 1) * leadsPerPage,
        currentPage * leadsPerPage
    );

    const paginatedOwners = filteredOwners.slice(
        (currentPage - 1) * leadsPerPage,
        currentPage * leadsPerPage
    );

    const toggleSelectAll = () => {
        if (selectedLeads.length === filteredLeads.length) setSelectedLeads([]);
        else setSelectedLeads(filteredLeads.map(l => String(l["Lead ID"] || "")));
    };

    const toggleSelect = (id: string) => {
        setSelectedLeads(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };


    return (
        <div className="space-y-6 pb-10 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">WhatsApp Leads</h1>
                    <p className="text-slate-500 text-sm">Review leads successfully contacted via WhatsApp</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-slate-100 rounded-lg p-0.5 mr-2">
                        <button
                            onClick={() => { setActiveTab("leads"); setCurrentPage(1); }}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === "leads" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            <Users className="h-3.5 w-3.5" /> Leads
                        </button>
                        <button
                            onClick={() => { setActiveTab("owners"); setCurrentPage(1); }}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === "owners" ? "bg-white text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            <Building2 className="h-3.5 w-3.5" /> Owners
                        </button>
                    </div>

                    {(activeFilters.replyStatus.length > 0 || activeFilters.loops.length > 0 || searchQuery) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={resetFilters}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2"
                        >
                            RESET FILTERS
                        </Button>
                    )}
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        className="pl-10 h-10 bg-slate-50/50 border-slate-200"
                        placeholder={`Search ${activeTab}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className={`gap-2 h-10 border-slate-200 ${activeFilters.replyStatus.length > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : ''}`}>
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

                    {activeTab === "leads" && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className={`gap-2 h-10 border-slate-200 ${activeFilters.loops.length > 0 ? 'bg-purple-50 border-purple-200 text-purple-700' : ''}`}>
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
                    )}

                    <Button variant="outline" className="gap-2 h-10 border-slate-200" onClick={() => {
                        if (dateRange?.from) fetchWAData(dateRange.from, dateRange.to || dateRange.from);
                    }}>
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedLeads.length > 0 && (
                <div className="bg-white border border-emerald-100 p-3 rounded-lg flex items-center justify-between shadow-sm">
                    <span className="text-sm font-bold text-slate-700">{selectedLeads.length} leads selected</span>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8 border-slate-200 text-slate-600 hover:text-slate-900">Export Selected</Button>
                    </div>
                </div>
            )}

            {/* Table */}
            <Card className="border-slate-200 overflow-hidden shadow-sm">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-200">
                                    <th className="px-4 py-4 w-[40px]">
                                        <Checkbox
                                            checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="px-4 py-4">{activeTab === "leads" ? "Name" : "Owner"}</th>
                                    <th className="px-4 py-4">Phone</th>
                                    <th className="px-4 py-4">{activeTab === "leads" ? "Loop" : "Source"}</th>
                                    <th className="px-4 py-4 text-center">Reply Status</th>
                                    <th className="px-4 py-4">WhatsApp Date</th>
                                    <th className="px-4 py-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {activeTab === "leads" ? (
                                    loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-20 text-center text-slate-400">
                                                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-500" />
                                                Loading WhatsApp leads...
                                            </td>
                                        </tr>
                                    ) : filteredLeads.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-20 text-center text-slate-400">
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
                                                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                                                    onClick={() => { setSelectedLeadIdForChat(id); setSelectedLeadObj(lead); }}
                                                >
                                                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={selectedLeads.includes(id)}
                                                            onCheckedChange={() => toggleSelect(id)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4 font-bold text-slate-900 group-hover:text-emerald-700">{lead["Name"] || "—"}</td>
                                                    <td className="px-4 py-4 text-slate-600 font-mono text-xs">{lead["Phone"] || "—"}</td>
                                                    <td className="px-4 py-4">
                                                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100 text-[10px] uppercase font-bold">
                                                            {lead.source_loop || "—"}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        {hasReplied
                                                            ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold">REPLIED</Badge>
                                                            : <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">SENT</Badge>
                                                        }
                                                    </td>
                                                    <td className="px-4 py-4 text-slate-500 text-xs">
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
                                    )
                                ) : (
                                    loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-20 text-center text-slate-400">
                                                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amber-500" />
                                                Loading owner leads...
                                            </td>
                                        </tr>
                                    ) : filteredOwners.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-20 text-center text-slate-400">
                                                No owner leads found for this date range.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedOwners.map((owner, index) => {
                                            const wtsReply = owner["WTS_Reply_Track"];
                                            const hasReplied = wtsReply && wtsReply !== "" && String(wtsReply).toLowerCase() !== "no";
                                            const waDate = getOwnerDate(owner);
                                            return (
                                                <tr
                                                    key={`${owner.id || ''}-${owner.contactNo || ''}-${index}`}
                                                    className="hover:bg-amber-50/30 transition-colors group cursor-pointer"
                                                >
                                                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox />
                                                    </td>
                                                    <td className="px-4 py-4 font-bold text-slate-900 group-hover:text-amber-700">{owner.name || "—"}</td>
                                                    <td className="px-4 py-4 text-slate-600 font-mono text-xs">{owner.contactNo || "—"}</td>
                                                    <td className="px-4 py-4">
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[10px] uppercase font-bold">
                                                            OWNER DATA
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        {hasReplied
                                                            ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold">REPLIED</Badge>
                                                            : <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">SENT</Badge>
                                                        }
                                                    </td>
                                                    <td className="px-4 py-4 text-slate-500 text-xs">
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
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-slate-500">
                            Showing <span className="font-bold text-slate-900">
                                {activeTab === "leads" ? paginatedLeads.length : paginatedOwners.length}
                            </span> of <span className="font-bold text-slate-900">
                                {activeTab === "leads" ? filteredLeads.length : filteredOwners.length}
                            </span> {activeTab}
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

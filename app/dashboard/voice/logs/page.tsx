"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, ChevronLeft, ChevronRight, User, Download, Search, Info, Activity, Crown, Phone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LMLoader } from "@/components/lm-loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import React, { useState, useEffect } from "react";
import { CallDetailsModal } from "@/components/voice/call-details-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format, subDays } from "date-fns";
import { formatDuration } from "@/lib/utils";
import { useData } from "@/context/DataContext";

const DynamicRowCells = ({ call, leads, telephonyCost }: { call: any, leads: any[], telephonyCost?: number }) => {
    let guestName = call.name || "Guest";
    const guestNum = call.phone || "Unknown";
    const realType = call.type || (call.isInbound ? "Inbound" : "Outbound");
    const isInboundState = call.isInbound;

    if ((!guestName || guestName === "Guest" || guestName === "Unknown") && call.phone && leads) {
        const targetPhone = call.phone.replace(/\D/g, '');
        if (targetPhone && targetPhone.length > 5) {
            const foundLead = leads.find((l: any) => l.phone && l.phone.replace(/\D/g, '') === targetPhone);
            if (foundLead && foundLead.name) guestName = foundLead.name;
        }
    }

    return (
        <>
            <TableCell className="font-semibold text-slate-900">
                <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    {guestName}
                </div>
            </TableCell>
            <TableCell className="font-medium text-slate-800">{guestNum}</TableCell>
            <TableCell>
                <div className="flex flex-col gap-1">
                    <Badge 
                        variant="outline" 
                        className={`text-[10px] uppercase font-bold tracking-wider w-fit px-2 py-0.5 ${
                            isInboundState 
                                ? 'bg-blue-50 text-blue-600 border-slate-200' 
                                : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}
                    >
                        {realType}
                    </Badge>
                    {call.vapiAccount === 'owners' && (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[8px] px-1.5 py-0 h-3.5 font-bold uppercase tracking-wider w-fit flex items-center gap-1">
                             owner leads
                        </Badge>
                    )}
                    {call.assistantId === '560ca61b-8cd3-4b5f-996b-2966abfa37fd' && (
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200 text-[8px] px-1.5 py-0 h-3.5 font-bold uppercase tracking-wider w-fit">
                            secondary leads reachout
                        </Badge>
                    )}
                    {call.assistantId === '1ef6ea66-0a75-45f5-b025-1743e048dc90' && (
                        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200 text-[8px] px-1.5 py-0 h-3.5 font-bold uppercase tracking-wider w-fit flex items-center gap-1">
                            open house event
                        </Badge>
                    )}
                </div>
            </TableCell>
            <TableCell className="text-slate-600 font-medium">{formatDuration(call.durationSeconds)}</TableCell>
            <TableCell className="text-slate-500 text-xs">{call.country || 'Unknown'}</TableCell>
            <TableCell className="font-bold text-emerald-600">
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="hover:underline flex items-center gap-1 cursor-help" onClick={(e) => e.stopPropagation()}>
                            {telephonyCost !== undefined && telephonyCost !== -1 
                                ? `$${((call.breakdown?.agent || 0) + telephonyCost).toFixed(3)}` 
                                : call.cost}
                            <Info className="h-3 w-3 text-slate-300" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-4 bg-white shadow-xl border-slate-200" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 border-b pb-2">
                                <Activity className="h-4 w-4 text-blue-600" />
                                <h4 className="font-bold text-sm text-slate-900">Cost Breakdown</h4>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[11px] text-slate-500">
                                    <span>Agent (Vapi/AI):</span>
                                    <span className="font-mono text-slate-700">${(call.breakdown?.agent || 0).toFixed(3)}</span>
                                </div>
                                <div className="flex justify-between text-[11px] text-slate-500">
                                    <span>Telephony (Provider):</span>
                                    {telephonyCost === -1 ? (
                                        <span className="font-mono text-slate-400 italic">loading...</span>
                                    ) : (
                                        <span className="font-mono text-slate-700">${(telephonyCost !== undefined ? telephonyCost : (call.breakdown?.telephony || 0)).toFixed(3)}</span>
                                    )}
                                </div>
                            </div>
                            <div className="border-t pt-2 mt-2 flex justify-between text-xs font-bold text-slate-900">
                                <span>Total Estimated:</span>
                                <span className="text-emerald-600">
                                    {telephonyCost !== undefined && telephonyCost !== -1 
                                        ? `$${((call.breakdown?.agent || 0) + telephonyCost).toFixed(3)}` 
                                        : call.cost}
                                </span>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </TableCell>
        </>
    );
};

export default function VoiceLogsPage() {
    const { calls: globalCalls, loadingCalls, refreshCalls, leads, loadingLeads } = useData();
    const [allCallsMapped, setAllCallsMapped] = useState<any[]>([]);
    const [calls, setCalls] = useState<any[]>([]);
    const loading = loadingCalls;
    const [selectedCall, setSelectedCall] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 7), to: new Date() });
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    // accountFilter: 'vapi' | 'vapi-owners' | 'vapi-normal' | 'elevenlabs'
    const [accountFilter, setAccountFilter] = useState("vapi");
    const [phoneFilter, setPhoneFilter] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [regionFilter, setRegionFilter] = useState("all");
    const [costModalOpen, setCostModalOpen] = useState(false);
    const [telephonyCosts, setTelephonyCosts] = useState<Record<string, number>>({});
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        setDateRange({
            from: subDays(new Date(), 7),
            to: new Date(),
        });
    }, []);

    // Server-side refresh when filters change
    useEffect(() => {
        if (!refreshCalls) return;
        const isDefaultRange = !dateRange;
        const includeElevenLabs = accountFilter === 'elevenlabs';
        const provider = accountFilter === 'elevenlabs' ? 'elevenlabs' : 'vapi';
        refreshCalls({
            from: isDefaultRange ? undefined : dateRange?.from,
            to: isDefaultRange ? undefined : (dateRange?.to || dateRange?.from),
            includeElevenLabs,
            provider
        });
    }, [dateRange, accountFilter, refreshCalls]);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        if (loadingLeads || !globalCalls) return;

        const mappedCalls = globalCalls.map((c: any) => {
            let resolvedName = c.name;
            if ((!resolvedName || resolvedName === "Guest" || resolvedName === "Unknown") && c.phone && leads) {
                const targetPhone = c.phone.replace(/\D/g, '');
                if (targetPhone && targetPhone.length > 5) {
                    const foundLead = leads.find((l: any) => l.phone && l.phone.replace(/\D/g, '') === targetPhone);
                    if (foundLead && foundLead.name) resolvedName = foundLead.name;
                }
            }
            const UAE_BOT_ID = '70f05e16-18f3-4f6e-964a-f47b299c6c1d';
            const UAE_BUSINESS_NUMBER = '+97148714150';
            let resolvedType = c.type || (c.isInbound ? "Inbound" : "Outbound");
            
            // If the call is from the UAE bot or the UAE business number to a customer, it's Outbound.
            if (resolvedType === "Inbound") {
                const isFromUAEBot = c.assistantId === UAE_BOT_ID;
                const isFromUAENumber = c.fromNumber === UAE_BUSINESS_NUMBER || c.phoneNumber === UAE_BUSINESS_NUMBER;
                
                if ((isFromUAEBot || isFromUAENumber) && c.phone) {
                    resolvedType = "Outbound";
                }
            }

            return {
                ...c,
                name: resolvedName,
                type: resolvedType,
                displayDate: c.startedAt ? format(new Date(c.startedAt), 'PPp') : 'N/A',
                displayDuration: formatDuration(c.durationSeconds || 0),
            };
        });

        setAllCallsMapped(mappedCalls);
    }, [globalCalls, leads, loadingLeads]);

    useEffect(() => {
        setCurrentPage(1);
    }, [dateRange, statusFilter, typeFilter, accountFilter, phoneFilter, sortBy, regionFilter]);

    useEffect(() => {
        const filteredCalls = allCallsMapped.filter((call: any) => {
            // 1. Account / provider filter (must pass first)
            if (accountFilter === 'vapi' && call.source !== 'vapi') return false;
            if (accountFilter === 'vapi-normal' && (call.source !== 'vapi' || call.vapiAccount !== 'normal')) return false;
            if (accountFilter === 'vapi-owners' && (call.source !== 'vapi' || call.vapiAccount !== 'owners')) return false;
            if (accountFilter === 'elevenlabs' && call.source !== 'elevenlabs') return false;
            if (accountFilter === 'open-house' && call.assistantId !== '1ef6ea66-0a75-45f5-b025-1743e048dc90') return false;

            // 2. Status filter
            if (statusFilter !== "all" && call.status !== statusFilter) return false;

            // 3. Type filter
            if (typeFilter !== "all") {
                const normalizedCallType = (call.type || (call.isInbound ? "Inbound" : "Outbound")).toLowerCase();
                const isSecondaryLeads = call.assistantId === '560ca61b-8cd3-4b5f-996b-2966abfa37fd';

                if (typeFilter === "secondary-leads") {
                    if (!isSecondaryLeads) return false;
                } else if (typeFilter === "normal") {
                    if (isSecondaryLeads) return false;
                } else if (normalizedCallType !== typeFilter.toLowerCase()) {
                    return false;
                }
            }

            // 4. Phone / name search
            if (phoneFilter) {
                const searchStr = phoneFilter.toLowerCase().trim();
                const phoneSearch = searchStr.replace(/\D/g, '');
                const phoneTarget = (call.phone || "").replace(/\D/g, '');
                const matchesPhone = phoneSearch && phoneTarget.includes(phoneSearch);
                const matchesName = (call.name || "Guest").toLowerCase().includes(searchStr);
                if (!matchesPhone && !matchesName) return false;
            }

            // 5. Region / Assistant filter
            if (regionFilter !== "all") {
                const assistantId = call.assistantId;
                const assistantNum = (call.phoneNumber || call.fromNumber || "").replace(/\D/g, '');
                const regionMap: Record<string, { nums: string[], ids: string[] }> = {
                    "uae": {
                        nums: ["97148714150"],
                        ids: ["70f05e16-18f3-4f6e-964a-f47b299c6c1d", "9ac979c3-a0b3-4af6-bb0d-07ddf9c0d1cd"]
                    },
                    "us": {
                        nums: ["14782159151", "17624000439"],
                        ids: ["b35e3032-7865-4913-ba22-a913b5d4117b"]
                    },
                    "uk": {
                        nums: ["447462179309", "7462179309"],
                        ids: ["918c25eb-9882-452e-86df-b4851d464852"]
                    }
                };
                const target = regionMap[regionFilter];
                if (target) {
                    const matchesNum = assistantNum && target.nums.some(n => assistantNum.endsWith(n) || n.endsWith(assistantNum));
                    const matchesId = assistantId && target.ids.includes(assistantId);
                    if (!matchesNum && !matchesId) return false;
                }
            }

            return true;
        });

        const sortedCalls = [...filteredCalls].sort((a, b) => {
            if (sortBy === "longest") return (b.durationSeconds || 0) - (a.durationSeconds || 0);
            if (sortBy === "shortest") return (a.durationSeconds || 0) - (b.durationSeconds || 0);
            if (sortBy === "oldest") {
                return (a.startedAt ? new Date(a.startedAt).getTime() : 0) - (b.startedAt ? new Date(b.startedAt).getTime() : 0);
            }
            return (b.startedAt ? new Date(b.startedAt).getTime() : 0) - (a.startedAt ? new Date(a.startedAt).getTime() : 0);
        });

        setCalls(sortedCalls);
    }, [allCallsMapped, dateRange, statusFilter, typeFilter, accountFilter, phoneFilter, sortBy, regionFilter]);

    const handleRefresh = () => {
        const includeElevenLabs = accountFilter === 'elevenlabs';
        const provider = accountFilter === 'elevenlabs' ? 'elevenlabs' : 'vapi';
        refreshCalls({
            from: dateRange?.from,
            to: dateRange?.to || dateRange?.from,
            includeElevenLabs,
            provider,
            force: true
        });
    };

    const handleExport = async () => {
        if (calls.length === 0) return;
        setExporting(true);

        try {
            // Find calls that don't have telephony costs yet
            const missingCostCalls = calls.filter(c => telephonyCosts[c.id] === undefined && c.source !== 'elevenlabs');
            
            let allCosts = { ...telephonyCosts };
            
            if (missingCostCalls.length > 0) {
                // Fetch costs in batches of 100 to avoid long request issues, though our backend is fast now
                const res = await fetch('/api/calls/telephony-cost', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        calls: missingCostCalls.map(c => ({
                            id: c.id,
                            phoneNumber: c.phoneNumber,
                            phone: c.phone,
                            durationSeconds: c.durationSeconds,
                            isInbound: c.isInbound
                        }))
                    })
                });
                const data = await res.json();
                if (data && data.costs) {
                    allCosts = { ...allCosts, ...data.costs };
                    setTelephonyCosts(prev => ({ ...prev, ...data.costs }));
                }
            }

            const headers = ["Name", "Phone", "Type", "Duration (sec)", "Duration (min)", "Country", "Telephony Cost", "Total Cost", "Status", "Date"];
            
            const csvData = calls.map(call => {
                const tCost = allCosts[call.id];
                const agentCost = call.breakdown?.agent || 0;
                let totalCostStr = call.cost;
                let telephonyCostStr = "N/A";

                if (tCost !== undefined && tCost !== -1) {
                    telephonyCostStr = `$${tCost.toFixed(3)}`;
                    totalCostStr = `$${(agentCost + tCost).toFixed(3)}`;
                }

                return [
                    call.name || "Guest",
                    call.phone || "Unknown",
                    call.type,
                    call.durationSeconds || 0,
                    ((call.durationSeconds || 0) / 60).toFixed(2),
                    call.country || "Unknown",
                    telephonyCostStr,
                    totalCostStr,
                    call.status,
                    call.displayDate
                ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
            });
            
            const csvContent = "\uFEFF" + [headers.join(","), ...csvData].join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `voice_logs_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("Export error:", err);
        } finally {
            setExporting(false);
        }
    };

    const paginatedCalls = calls.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    useEffect(() => {
        if (!paginatedCalls || paginatedCalls.length === 0) return;

        const callsToFetch = paginatedCalls.filter(c => telephonyCosts[c.id] === undefined && c.source !== 'elevenlabs');
        if (callsToFetch.length === 0) return;

        setTelephonyCosts(prev => {
            const fetching = { ...prev };
            callsToFetch.forEach(c => fetching[c.id] = -1);
            return fetching;
        });

        fetch('/api/calls/telephony-cost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                calls: callsToFetch.map(c => ({
                    id: c.id,
                    phoneNumber: c.phoneNumber,
                    phone: c.phone,
                    durationSeconds: c.durationSeconds,
                    isInbound: c.isInbound,
                    startedAt: c.startedAt
                }))
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.costs) {
                setTelephonyCosts(prev => ({ ...prev, ...data.costs }));
            }
        })
        .catch(err => console.error("Error fetching telephony costs", err));
    }, [paginatedCalls]);

    return (
        <div className="space-y-6 pb-10 relative min-h-[500px]">
            {/* Absolute Full-Screen Loader for Initial Load */}
            {loading && allCallsMapped.length === 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                    <LMLoader />
                </div>
            )}
            
            {/* Subtle Overlay Loader for Background Refreshes (Filtering) */}
            {loading && allCallsMapped.length > 0 && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/20 backdrop-blur-[1px] pointer-events-none">
                    <div className="bg-white/80 p-6 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center gap-3">
                        <LMLoader />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Updating Logs...</span>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Call Logs</h1>
                        <p className="text-slate-500">Comprehensive history across all accounts and providers.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" className="text-slate-600 border-slate-200" onClick={() => setCostModalOpen(true)}>
                            <Info className="h-4 w-4 mr-2" />
                            Cost Info
                        </Button>
                        <Button 
                            variant="outline" 
                            className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100" 
                            onClick={handleExport}
                            disabled={exporting || calls.length === 0}
                        >
                            <Download className={`h-4 w-4 mr-2 ${exporting ? 'animate-pulse' : ''}`} />
                            {exporting ? 'Exporting...' : 'Download Excel'}
                        </Button>
                        <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Filters Bar */}
                <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                    <div className="relative w-[220px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search name or phone..."
                            className="pl-9 h-9"
                            value={phoneFilter}
                            onChange={(e) => setPhoneFilter(e.target.value)}
                        />
                    </div>

                    <Select value={accountFilter} onValueChange={setAccountFilter}>
                        <SelectTrigger className="w-[200px] h-9">
                            <SelectValue placeholder="Account / Provider" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="vapi">All Vapi Calls</SelectItem>
                            <SelectItem value="vapi-owners">Owner Leads</SelectItem>
                            <SelectItem value="vapi-normal">Normal Calls</SelectItem>
                            <SelectItem value="open-house">🏠 Open House Event</SelectItem>
                            <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Call Type" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="Inbound">Inbound</SelectItem>
                            <SelectItem value="Outbound">Outbound</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="answered">Answered / Done</SelectItem>
                            <SelectItem value="failed">Failed / Error</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={regionFilter} onValueChange={setRegionFilter}>
                        <SelectTrigger className="w-[165px] h-9">
                            <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-slate-400" />
                                <SelectValue placeholder="Region" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Regions</SelectItem>
                            <SelectItem value="us">United States</SelectItem>
                            <SelectItem value="uk">United Kingdom</SelectItem>
                            <SelectItem value="uae">UAE (Dubai)</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Sort By" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                            <SelectItem value="longest">Longest Duration</SelectItem>
                            <SelectItem value="shortest">Shortest Duration</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="border-slate-200 overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                                <TableHead className="w-[150px]">Name</TableHead>
                                <TableHead>Guest Number</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Country</TableHead>
                                <TableHead>Cost</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[200px]">Date &amp; Time</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {calls.length === 0 && !loading ? (
                                <TableRow><TableCell colSpan={8} className="h-24 text-center text-slate-500 font-medium">No calls matching filters.</TableCell></TableRow>
                            ) : (
                                (paginatedCalls as any[]).map((call) => (
                                    <TableRow
                                        key={call.id}
                                        className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                                        onClick={() => { setSelectedCall(call); setModalOpen(true); }}
                                    >
                                        <DynamicRowCells call={call} leads={leads} telephonyCost={telephonyCosts[call.id]} />
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[10px] uppercase border-${call.status === 'answered' ? 'emerald' : 'slate'}-200 text-${call.status === 'answered' ? 'emerald' : 'slate'}-600`}>
                                                {call.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-slate-500 text-xs">{call.displayDate}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                        Showing <span className="font-bold text-slate-900">{calls.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, calls.length)}</span> of {calls.length} calls
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium px-3 py-1">Page {currentPage}</span>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentPage(p => Math.min(Math.ceil(calls.length / itemsPerPage), p + 1))} disabled={currentPage >= Math.ceil(calls.length / itemsPerPage)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </Card>

            <CallDetailsModal open={modalOpen} onOpenChange={setModalOpen} call={selectedCall} />

            {/* Cost Info Modal */}
            <Dialog open={costModalOpen} onOpenChange={setCostModalOpen}>
                <DialogContent className="sm:max-w-[500px] bg-white border-slate-200 shadow-xl overflow-hidden p-0">
                    <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                                <Info className="h-5 w-5" />
                            </div>
                            How Costing is Calculated
                        </DialogTitle>
                        <DialogDescription className="text-slate-500">
                            Understanding our automated billing and rate matching logic.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            {[
                                { n: 1, title: "Normalization", desc: "System cleans phone numbers by removing all symbols and spaces, ensuring consistent lookup against our global rate database." },
                                { n: 2, title: "Longest-Prefix Matching", desc: "We use high-precision matching. If a number matches multiple regions (e.g. UAE General vs Dubai Fixed), we prioritize the most specific prefix for maximum accuracy." },
                                { n: 3, title: "Per-Minute Computation", desc: "Duration is tracked in seconds and rounded up to the nearest minute. For outbound calls, the matched rate is applied. Inbound calls are always computed at $0.02." },
                                { n: 4, title: "Special Backup Rates", desc: "For outbound calls from US or UK numbers to UAE destinations, a fixed backup rate of $0.2995/min is applied to ensure connectivity." },
                            ].map(({ n, title, desc }) => (
                                <div key={n} className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">{n}</div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm mb-1">{title}</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
                        <a href="/billing-plan.pdf" download className="w-full">
                            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200">
                                <Download className="h-4 w-4 mr-2" />
                                Download Billing Plan PDF
                            </Button>
                        </a>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw, ChevronLeft, ChevronRight, User, Download, Search, Info, Activity, Phone } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LMLoader } from "@/components/ryan-loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { CallDetailsModal } from "@/components/voice/call-details-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { format, subDays } from "date-fns";
import { formatDuration } from "@/lib/utils";
import { useData } from "@/context/DataContext";

const DynamicRowCells = ({ call, telephonyCost }: { call: any, telephonyCost?: number }) => {
    const guestName = call.name || "Guest";
    const guestNum = call.phone || "Unknown";
    const realType = call.type || (call.isInbound ? "Inbound" : "Outbound");
    const isInboundState = call.isInbound;

    return (
        <>
            <TableCell className="font-semibold text-[var(--label-primary)]">
                <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-[var(--label-tertiary)]" />
                    {guestName}
                </div>
            </TableCell>
            <TableCell className="font-medium text-[var(--label-primary)]">{guestNum}</TableCell>
            <TableCell>
                <div className="flex flex-col gap-1">
                    <Badge 
                        variant="outline" 
                        className={`text-[10px] uppercase font-bold tracking-wider w-fit px-2 py-0.5 ${
                            isInboundState 
                                ? 'bg-[rgba(0,122,255,0.08)] text-blue-600 border-[var(--separator)]' 
                                : 'bg-[rgba(0,122,255,0.08)] text-blue-700 border-blue-100'
                        }`}
                    >
                        {realType}
                    </Badge>
                    {call.assistantId === '560ca61b-8cd3-4b5f-996b-2966abfa37fd' && (
                        <Badge className="bg-[rgba(175,82,222,0.08)] text-purple-700 hover:bg-[rgba(175,82,222,0.08)] border-purple-200 text-[8px] px-1.5 py-0 h-3.5 font-bold uppercase tracking-wider w-fit">
                            secondary leads reachout
                        </Badge>
                    )}
                    {call.assistantId === '1ef6ea66-0a75-45f5-b025-1743e048dc90' && (
                        <Badge className="bg-[rgba(255,149,0,0.08)] text-orange-700 hover:bg-[rgba(255,149,0,0.08)] border-orange-200 text-[8px] px-1.5 py-0 h-3.5 font-bold uppercase tracking-wider w-fit flex items-center gap-1">
                            open house event
                        </Badge>
                    )}
                </div>
            </TableCell>
            <TableCell className="text-[var(--label-secondary)] font-medium">{call.displayDuration || formatDuration(call.durationSeconds)}</TableCell>
            <TableCell className="text-[var(--label-secondary)] text-xs">
                {call.leadTemp ? (
                    <Badge 
                        variant="outline" 
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${
                            call.leadTemp.toUpperCase() === 'HOT'
                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                : call.leadTemp.toUpperCase() === 'WARM'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : call.leadTemp.toUpperCase() === 'COLD'
                                ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                        }`}
                    >
                        {call.leadTemp}
                    </Badge>
                ) : (
                    <span className="text-[var(--label-tertiary)] font-medium">Unknown</span>
                )}
            </TableCell>
            <TableCell className="font-bold text-emerald-600">
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="hover:underline flex items-center gap-1 cursor-help" onClick={(e) => e.stopPropagation()}>
                            {telephonyCost !== undefined && telephonyCost !== -1 
                                ? `$${((call.breakdown?.agent || 0) + telephonyCost).toFixed(3)}` 
                                : call.cost}
                            <Info className="h-3 w-3 text-[var(--label-tertiary)]" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-4 bg-[var(--glass-fill)] shadow-xl border-[var(--separator)]" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 border-b pb-2">
                                <Activity className="h-4 w-4 text-blue-600" />
                                <h4 className="font-bold text-sm text-[var(--label-primary)]">Cost Breakdown</h4>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[11px] text-[var(--label-secondary)]">
                                    <span>Agent (Vapi/AI):</span>
                                    <span className="font-mono text-[var(--label-primary)]">${(call.breakdown?.agent || 0).toFixed(3)}</span>
                                </div>
                                <div className="flex justify-between text-[11px] text-[var(--label-secondary)]">
                                    <span>Telephony (Provider):</span>
                                    {telephonyCost === -1 ? (
                                        <span className="font-mono text-[var(--label-tertiary)] italic">loading...</span>
                                    ) : (
                                        <span className="font-mono text-[var(--label-primary)]">${(telephonyCost !== undefined ? telephonyCost : (call.breakdown?.telephony || 0)).toFixed(3)}</span>
                                    )}
                                </div>
                            </div>
                            <div className="border-t pt-2 mt-2 flex justify-between text-xs font-bold text-[var(--label-primary)]">
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
    const { calls: globalCalls, loadingCalls, refreshCalls } = useData();
    const [calls, setCalls] = useState<any[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const loading = loadingCalls;
    const [selectedCall, setSelectedCall] = useState<any>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [dateRange, setDateRange] = useState<any>({ from: subDays(new Date(), 7), to: new Date() });
    const [statusFilter, setStatusFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [accountFilter, setAccountFilter] = useState("vapi");
    const [phoneFilter, setPhoneFilter] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [tempFilter, setTempFilter] = useState("all");
    const [costModalOpen, setCostModalOpen] = useState(false);
    const [telephonyCosts, setTelephonyCosts] = useState<Record<string, number>>({});
    const [exporting, setExporting] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const [debouncedPhoneFilter, setDebouncedPhoneFilter] = useState("");

    useEffect(() => {
        setDateRange({ from: subDays(new Date(), 7), to: new Date() });
    }, []);

    // Debounce phone search
    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedPhoneFilter(phoneFilter);
        }, 300);
        return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
    }, [phoneFilter]);

    // All server-side: pass ALL filters to the API
    useEffect(() => {
        if (!refreshCalls) return;
        refreshCalls({
            from: dateRange?.from,
            to: dateRange?.to || dateRange?.from,
            account: accountFilter,
            status: statusFilter,
            type: typeFilter,
            phone: debouncedPhoneFilter || undefined,
            leadTemp: tempFilter,
            sort: sortBy,
            page: currentPage,
            limit: itemsPerPage,
        });
    }, [dateRange, accountFilter, statusFilter, typeFilter, debouncedPhoneFilter, tempFilter, sortBy, currentPage, refreshCalls]);

    // Update calls directly from globalCalls (already server-processed)
    useEffect(() => {
        if (Array.isArray(globalCalls)) {
            setCalls(globalCalls);
        }
    }, [globalCalls]);

    const handleRefresh = () => {
        refreshCalls({
            from: dateRange?.from,
            to: dateRange?.to || dateRange?.from,
            account: accountFilter,
            status: statusFilter,
            type: typeFilter,
            phone: debouncedPhoneFilter || undefined,
            leadTemp: tempFilter,
            sort: sortBy,
            page: currentPage,
            limit: itemsPerPage,
            force: true,
        });
    };

    const handleExport = async () => {
        if (calls.length === 0) return;
        setExporting(true);

        try {
            const missingCostCalls = calls.filter(c => telephonyCosts[c.id] === undefined);
            let allCosts = { ...telephonyCosts };

            if (missingCostCalls.length > 0) {
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

            const headers = ["Name", "Phone", "Type", "Duration (sec)", "Duration (min)", "Temperature", "Telephony Cost", "Total Cost", "Status", "Date"];

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
                    call.leadTemp || "Unknown",
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

    // Fetch telephony costs for visible calls
    useEffect(() => {
        if (!calls || calls.length === 0) return;

        const callsToFetch = calls.filter(c => telephonyCosts[c.id] === undefined);
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
    }, [calls]);

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    return (
        <div className="space-y-6 pb-10 relative min-h-[500px]">
            {/* Absolute Full-Screen Loader for Initial Load */}
            {loading && calls.length === 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--glass-fill)]/60 backdrop-blur-sm">
                    <LMLoader />
                </div>
            )}

            {/* Subtle Overlay Loader for Background Refreshes (Filtering) */}
            {loading && calls.length > 0 && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--glass-fill)]/20 backdrop-blur-[1px] pointer-events-none">
                    <div className="bg-[var(--glass-fill)]/80 p-6 rounded-2xl shadow-xl border border-[var(--separator)] flex flex-col items-center gap-3">
                        <LMLoader />
                        <span className="text-xs font-bold text-[var(--label-secondary)] uppercase tracking-widest animate-pulse">Updating Logs...</span>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--label-primary)]">Call Logs</h1>
                        <p className="text-[var(--label-secondary)]">Comprehensive history across all accounts and providers.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" className="text-[var(--label-secondary)] border-[var(--separator)]" onClick={() => setCostModalOpen(true)}>
                            <Info className="h-4 w-4 mr-2" />
                            Cost Info
                        </Button>
                        <Button 
                            variant="outline" 
                            className="bg-[rgba(52,199,89,0.08)] text-emerald-700 border-emerald-100 hover:bg-emerald-100" 
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
                <div className="flex flex-wrap items-center gap-3 bg-[var(--glass-fill)] p-3 rounded-xl border border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)]">
                    <div className="relative w-[220px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--label-tertiary)]" />
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
                            <SelectItem value="vapi-normal">Normal Calls</SelectItem>
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

                    <Select value={tempFilter} onValueChange={setTempFilter}>
                        <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Temperature" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Temps</SelectItem>
                            <SelectItem value="hot">Hot</SelectItem>
                            <SelectItem value="warm">Warm</SelectItem>
                            <SelectItem value="cold">Cold</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Sort By" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                            <SelectItem value="longest">Longest First</SelectItem>
                            <SelectItem value="shortest">Shortest First</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Call Table */}
            <div className="bg-[var(--glass-fill)] rounded-xl border border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[var(--fill-quaternary)]">
                            <TableHead className="font-bold text-[var(--label-primary)]">Name</TableHead>
                            <TableHead className="font-bold text-[var(--label-primary)]">Phone</TableHead>
                            <TableHead className="font-bold text-[var(--label-primary)]">Type</TableHead>
                            <TableHead className="font-bold text-[var(--label-primary)]">Duration</TableHead>
                            <TableHead className="font-bold text-[var(--label-primary)]">Temperature</TableHead>
                            <TableHead className="font-bold text-[var(--label-primary)]">Cost</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {calls.map((call: any, idx: number) => (
                            <TableRow
                                key={call.id || idx}
                                className="cursor-pointer hover:bg-[rgba(0,122,255,0.08)]/50 transition-colors"
                                onClick={() => { setSelectedCall(call); setModalOpen(true); }}
                            >
                                <DynamicRowCells call={call} telephonyCost={telephonyCosts[call.id]} />
                            </TableRow>
                        ))}
                        {calls.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-[var(--label-tertiary)]">
                                    No calls found for the selected filters.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-[var(--label-secondary)]">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} calls
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium text-[var(--label-primary)]">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Call Details Modal */}
            <CallDetailsModal call={selectedCall} open={modalOpen} onOpenChange={setModalOpen} />

            {/* Cost Info Modal */}
            <Dialog open={costModalOpen} onOpenChange={setCostModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cost Breakdown Info</DialogTitle>
                        <DialogDescription>
                            Voice call costs include AI agent usage (Vapi) and telephony charges (provider).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 text-sm text-[var(--label-secondary)]">
                        <div>
                            <h4 className="font-semibold text-[var(--label-primary)]">Agent Cost (Vapi/AI):</h4>
                            <p>The cost of the AI voice agent processing the call.</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-[var(--label-primary)]">Telephony Cost (Provider):</h4>
                            <p>The cost of the phone line and carrier charges.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setCostModalOpen(false)}>Got it</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

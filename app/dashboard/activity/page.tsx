"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { LMLoader } from "@/components/ryan-loader";
import { useState, useEffect, useCallback, useRef } from "react";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { Search, ChevronLeft, ChevronRight, RefreshCw, Phone, Mail, MessageCircle, Activity, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const CHANNEL_OPTIONS = [
    { value: "all", label: "All Channels" },
    { value: "voice", label: "Voice" },
    { value: "email", label: "Email" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "sms", label: "SMS" },
];

const REPLIED_OPTIONS = [
    { value: "all", label: "All Replies" },
    { value: "yes", label: "Replied (Yes)" },
    { value: "no", label: "Not Replied (No)" },
];

function getChannelIcon(channel: string) {
    const c = channel.toLowerCase();
    if (c === "voice") return <Phone className="h-3.5 w-3.5" />;
    if (c === "email") return <Mail className="h-3.5 w-3.5" />;
    if (c === "whatsapp" || c === "sms") return <MessageCircle className="h-3.5 w-3.5" />;
    return <Activity className="h-3.5 w-3.5" />;
}

function getChannelBadgeVariant(channel: string) {
    const c = channel.toLowerCase();
    if (c === "voice") return "default" as const;
    if (c === "email") return "purple" as const;
    if (c === "whatsapp") return "success" as const;
    if (c === "sms") return "warning" as const;
    return "secondary" as const;
}

function getSourceBadge(table: string) {
    const t = table.replace("_activity", "");
    if (t === "fello") return { label: "Fello", variant: "default" as const };
    if (t === "aspen") return { label: "Aspen", variant: "purple" as const };
    if (t === "naples") return { label: "Naples", variant: "success" as const };
    if (t === "old") return { label: "Legacy", variant: "warning" as const };
    return { label: t, variant: "secondary" as const };
}

export default function ActivityPage() {
    const [activities, setActivities] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [channelFilter, setChannelFilter] = useState("all");
    const [replyFilter, setReplyFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [errors, setErrors] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 90),
        to: new Date(),
    });
    const dateRangeRef = useRef(dateRange);
    dateRangeRef.current = dateRange;

    const limit = 25;

    const fetchActivity = useCallback(async () => {
        setLoading(true);
        setErrors([]);
        try {
            const params = new URLSearchParams();
            const dr = dateRangeRef.current;
            if (dr?.from) params.set("from", startOfDay(dr.from).toISOString());
            if (dr?.to) params.set("to", endOfDay(dr.to).toISOString());
            if (channelFilter && channelFilter !== "all") params.set("channel", channelFilter);
            if (replyFilter && replyFilter !== "all") params.set("reply", replyFilter);
            if (searchQuery) params.set("search", searchQuery);
            params.set("page", String(currentPage));
            params.set("limit", String(limit));

            const res = await fetch(`/api/activity?${params.toString()}`);
            const data = await res.json();
            if (data.errors) setErrors(data.errors);
            setActivities(data.activities || []);
            setTotal(data.total || 0);
        } catch (err: any) {
            console.error("Error fetching activity:", err);
            setErrors([err.message]);
        } finally {
            setLoading(false);
        }
    }, [channelFilter, replyFilter, searchQuery, currentPage]);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

    const totalPages = Math.ceil(total / limit);

    return (
        <div className="space-y-6 pb-10 relative min-h-[500px]">
            {loading && <LMLoader />}

            {errors.length > 0 && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>API Errors</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc pl-4 mt-1 text-sm">
                            {errors.map((e, i) => <li key={i}>{e}</li>)}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--label-primary)]">Activity Log</h1>
                    <p className="text-[var(--label-secondary)]">
                        Unified activity feed across all channels and projects
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={fetchActivity} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                </div>
            </div>

            <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)]">
                <CardHeader className="pb-4 border-b border-[var(--separator)]">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--label-tertiary)]" />
                            <Input
                                placeholder="Search by name, phone, email, action..."
                                className="pl-10 h-10"
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[160px] h-10">
                                    <SelectValue placeholder="Channel" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CHANNEL_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={replyFilter} onValueChange={(v) => { setReplyFilter(v); setCurrentPage(1); }}>
                                <SelectTrigger className="w-[160px] h-10">
                                    <SelectValue placeholder="Replied" />
                                </SelectTrigger>
                                <SelectContent>
                                    {REPLIED_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-[var(--bg-app)]/50">
                                <TableHead>Lead</TableHead>
                                <TableHead>Channel</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Replied</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && activities.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        <div className="flex items-center justify-center gap-2 text-[var(--label-secondary)]">
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            Loading activity...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : activities.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-[var(--label-secondary)]">
                                        No activity found for the selected filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                activities.map((act: any, idx: number) => {
                                    const sourceInfo = getSourceBadge(act._source_table || "");
                                    const repliedVal = String(act.replied ?? '').toLowerCase().trim();
                                    const isReplied =
                                        repliedVal === 'yes' ||
                                        repliedVal === 'true' ||
                                        repliedVal === '1' ||
                                        act.status?.toLowerCase().includes('reply') ||
                                        act.status?.toLowerCase().includes('replied') ||
                                        !!act.replied_at;

                                    return (
                                        <TableRow key={act.id || idx} className="hover:bg-[var(--bg-app)]/50 transition-colors">
                                            <TableCell>
                                                <div className="font-medium text-[var(--label-primary)]">
                                                    {act.lead_name || "Unknown"}
                                                </div>
                                                <div className="text-xs text-[var(--label-secondary)]">
                                                    {act.lead_phone || act.lead_email || "—"}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getChannelBadgeVariant(act.channel)} className="gap-1.5">
                                                    {getChannelIcon(act.channel)}
                                                    {act.channel}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[var(--label-secondary)] text-sm max-w-[200px] truncate">
                                                {act.action_type || "—"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        act.status?.toLowerCase().includes("completed") ||
                                                        act.status?.toLowerCase().includes("success") ||
                                                        act.status?.toLowerCase().includes("delivered") ||
                                                        act.status?.toLowerCase().includes("read")
                                                            ? "success"
                                                            : act.status?.toLowerCase().includes("failed") ||
                                                              act.status?.toLowerCase().includes("error") ||
                                                              act.status?.toLowerCase().includes("bounce")
                                                            ? "destructive"
                                                            : act.status?.toLowerCase().includes("sent") ||
                                                              act.status?.toLowerCase().includes("pending")
                                                            ? "warning"
                                                            : "secondary"
                                                    }
                                                    className="text-[11px]"
                                                >
                                                    {act.status || "—"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={isReplied ? "success" : "outline"}
                                                    className="text-[11px]"
                                                >
                                                    {isReplied ? "Yes" : "No"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={sourceInfo.variant} className="text-[10px] uppercase font-bold">
                                                    {sourceInfo.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[var(--label-secondary)] text-sm whitespace-nowrap">
                                                {act.created_at
                                                    ? format(new Date(act.created_at), "MMM dd, yyyy • p")
                                                    : "—"}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>

                    {totalPages > 1 && (
                        <div className="px-6 py-4 border-t border-[var(--separator)] bg-[var(--bg-app)]/50 flex items-center justify-between">
                            <p className="text-sm text-[var(--label-secondary)]">
                                Showing{" "}
                                <span className="font-bold text-[var(--label-primary)]">
                                    {total > 0 ? (currentPage - 1) * limit + 1 : 0}
                                </span>
                                –
                                <span className="font-bold text-[var(--label-primary)]">
                                    {Math.min(currentPage * limit, total)}
                                </span>{" "}
                                of{" "}
                                <span className="font-bold text-[var(--label-primary)]">{total}</span>{" "}
                                activities
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-medium text-[var(--label-secondary)]">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

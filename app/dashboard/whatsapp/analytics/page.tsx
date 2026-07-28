"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
    TrendingUp,
    Users,
    MessageSquare,
    Send,
    RefreshCw,
    Info,
    Flame,
    Sun,
    Snowflake,
    ArrowUpRight,
    Eye,
    Database
} from "lucide-react";
import {
    Tooltip as UITooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { LMLoader } from "@/components/ryan-loader";

export default function WhatsappAnalyticsPage() {
    const router = useRouter();

    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: subDays(new Date(), 90),
        to: new Date()
    });

    const [loopData, setLoopData] = useState<{ nr_wf: any[]; followup: any[]; nurture: any[]; owners: any[]; wa_activity: any[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async (from: Date, to: Date) => {
        setLoading(true);
        const fromISO = startOfDay(from).toISOString();
        const toISO = endOfDay(to).toISOString();
        try {
            const res = await fetch(`/api/whatsapp-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
            if (res.ok) {
                const data = await res.json();
                setLoopData(data);
            }
        } catch (err) {
            console.error("[WA Analytics fetch]", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchData(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchData]);

    // Compute metrics aligned with the database schema
    const stats = useMemo(() => {
        if (!loopData) return {
            uniqueSentCount: 0,
            sentCount: 0,
            totalReplies: 0,
            trendData: [] as any[],
            tempData: [] as any[],
            tempCounts: { hot: 0, warm: 0, cold: 0, unassigned: 0 },
            statusCounts: { sent: 0, delivered: 0, read: 0, replied: 0, completed: 0, failed: 0 }
        };

        const nr_wf = (loopData.nr_wf || []).map(l => ({ ...l, source_loop: "Intro" }));
        const followup = (loopData.followup || []).map(l => ({ ...l, source_loop: "Follow Up" }));
        const nurture = (loopData.nurture || []).map(l => ({ ...l, source_loop: "Nurture" }));
        const waActivity = (loopData.wa_activity || []).map(a => ({
            ...a,
            source_loop: "Activity",
            "Name": a.lead_name || a.name || "",
            "Phone": a.lead_phone || a.phone || "",
            "W.P_1": a.created_at || true,
            wp1_parsed_date: a.created_at,
            "WP_Replied_track": a.replied_at ? "Replied" : "",
            status: a.status || (a.replied_at ? "replied" : "sent"),
            lead_temp: a.lead_temp || a.sentiment || "",
        }));

        const mergedLeads = [...nr_wf, ...followup, ...nurture, ...waActivity];

        const from = dateRange?.from ? startOfDay(dateRange.from).getTime() : null;
        const to = endOfDay(dateRange?.to || dateRange?.from || new Date()).getTime();
        const inRange = (t: number) => !from || (t >= from && t <= to);

        let uniqueSentCount = 0;
        let sentCount = 0;
        let totalReplies = 0;

        const dailyMap: Record<string, { reachouts: number; replies: number }> = {};
        const tempCounts = { hot: 0, warm: 0, cold: 0, unassigned: 0 };
        const statusCounts = { sent: 0, delivered: 0, read: 0, replied: 0, completed: 0, failed: 0 };

        const inRangeLeads = mergedLeads.filter(lead => {
            if (lead.source_loop === "Activity") {
                if (!lead.created_at) return true;
                return inRange(new Date(lead.created_at).getTime());
            }
            if (!lead["W.P_1"]) {
                const hasAnyWP = Array.from({ length: 12 }, (_, i) => lead[`W.P_${i + 1}`]).some(Boolean);
                if (!hasAnyWP && !lead["W.P_FollowUp"]) return false;
            }
            if (!lead.wp1_parsed_date) return true;
            return inRange(new Date(lead.wp1_parsed_date).getTime());
        });

        uniqueSentCount = inRangeLeads.length;

        inRangeLeads.forEach(lead => {
            // Sent count calculation
            if (lead.source_loop === "Activity") {
                if (lead.content) {
                    const lines = String(lead.content).split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('Template:') || trimmed.startsWith('User:') || trimmed.startsWith('Agent:') || trimmed.startsWith('Agent :')) {
                            sentCount++;
                        }
                    }
                } else {
                    sentCount++;
                }
            } else {
                for (let i = 1; i <= 12; i++) {
                    if (lead[`W.P_${i}`]) sentCount++;
                }
                if (lead["W.P_FollowUp"]) sentCount++;
                for (let i = 1; i <= 10; i++) {
                    if (lead[`W.P_FollowUp_${i}`] || lead[`W.P_FollowUp ${i}`]) sentCount++;
                }
                for (let i = 1; i <= 10; i++) {
                    if (lead[`W.P_Replied_${i}`] || lead[`W.P_Replied ${i}`]) sentCount++;
                }
            }

            // Replies
            const hasReplied = (() => {
                if (lead.source_loop === "Activity") {
                    return !!(lead.replied_at || lead.status === "completed" || lead.status === "replied");
                }
                const wp = lead.WP_Replied_track || lead["WP_Replied_track"];
                return !!(wp && String(wp).trim() && String(wp).trim().toLowerCase() !== "no" && String(wp).trim().toLowerCase() !== "none");
            })();

            if (hasReplied) totalReplies++;

            // Temperature distribution
            const tempVal = String(lead.lead_temp || lead.lead_temperature || lead["Lead Temperature"] || lead.sentiment || "").trim().toLowerCase();
            if (tempVal === 'hot' || tempVal === 'fire') {
                tempCounts.hot++;
            } else if (tempVal === 'warm') {
                tempCounts.warm++;
            } else if (tempVal === 'cold') {
                tempCounts.cold++;
            } else {
                tempCounts.unassigned++;
            }

            // Status distribution
            const stVal = String(lead.status || (hasReplied ? "replied" : "sent")).trim().toLowerCase();
            if (stVal.includes('read')) statusCounts.read++;
            else if (stVal.includes('delivered')) statusCounts.delivered++;
            else if (stVal.includes('replied')) statusCounts.replied++;
            else if (stVal.includes('completed')) statusCounts.completed++;
            else if (stVal.includes('failed') || stVal.includes('error')) statusCounts.failed++;
            else statusCounts.sent++;

            // Trend
            const dateSource = lead.wp1_parsed_date || lead.created_at || lead["Created At"];
            if (dateSource) {
                const dayKey = new Date(dateSource).toISOString().slice(0, 10);
                if (!isNaN(new Date(dateSource).getTime())) {
                    if (!dailyMap[dayKey]) dailyMap[dayKey] = { reachouts: 0, replies: 0 };
                    dailyMap[dayKey].reachouts++;
                    if (hasReplied) dailyMap[dayKey].replies++;
                }
            }
        });

        const trendData = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, { reachouts, replies }]) => ({
                date: format(new Date(date + 'T00:00:00'), 'MMM dd'),
                sent: reachouts,
                replied: replies,
            }));

        const tempData = [
            { name: "Hot 🔥", value: tempCounts.hot, color: "#f43f5e" },
            { name: "Warm ☀️", value: tempCounts.warm, color: "#f59e0b" },
            { name: "Cold ❄️", value: tempCounts.cold, color: "#3b82f6" },
            { name: "Unassigned", value: tempCounts.unassigned, color: "#94a3b8" }
        ].filter(t => t.value > 0);

        return {
            uniqueSentCount,
            sentCount,
            totalReplies,
            trendData,
            tempData,
            tempCounts,
            statusCounts
        };
    }, [loopData, dateRange]);

    const replyRate = stats.uniqueSentCount > 0
        ? ((stats.totalReplies / stats.uniqueSentCount) * 100).toFixed(1)
        : "0.0";

    // Per-table breakdown grouped by database table names (fello_activity, naples_activity, aspen_activity, old_activity, fello_leads, master_leads)
    const tableBreakdown = useMemo(() => {
        if (!loopData) return [];
        const from = dateRange?.from ? startOfDay(dateRange.from).getTime() : null;
        const to = endOfDay(dateRange?.to || dateRange?.from || new Date()).getTime();
        const inRange = (t: number) => !from || (t >= from && t <= to);

        const tableMap: Record<string, { name: string; reachouts: number; replied: number; color: string }> = {
            "fello_activity": { name: "fello_activity", reachouts: 0, replied: 0, color: "#3b82f6" },
            "naples_activity": { name: "naples_activity", reachouts: 0, replied: 0, color: "#10b981" },
            "aspen_activity": { name: "aspen_activity", reachouts: 0, replied: 0, color: "#f59e0b" },
            "old_activity": { name: "old_activity", reachouts: 0, replied: 0, color: "#8b5cf6" },
            "fello_leads": { name: "fello_leads", reachouts: 0, replied: 0, color: "#ec4899" },
            "master_leads": { name: "master_leads", reachouts: 0, replied: 0, color: "#6366f1" },
        };

        // 1. Process Activity Tables
        const waActivity = loopData.wa_activity || [];
        waActivity.forEach(a => {
            const tbl = a._source_table || "fello_activity";
            const createdTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            if (!inRange(createdTime)) return;

            if (!tableMap[tbl]) {
                tableMap[tbl] = { name: tbl, reachouts: 0, replied: 0, color: "#64748b" };
            }
            tableMap[tbl].reachouts++;
            if (a.replied_at || a.status === "completed" || a.status === "replied") {
                tableMap[tbl].replied++;
            }
        });

        // 2. Process Lead Tables (nr_wf, followup, nurture)
        const loopLeads = [
            ...(loopData.nr_wf || []).map(l => ({ ...l, fallbackTable: "fello_leads" })),
            ...(loopData.followup || []).map(l => ({ ...l, fallbackTable: "master_leads" })),
            ...(loopData.nurture || []).map(l => ({ ...l, fallbackTable: "master_leads" })),
        ];

        loopLeads.forEach(l => {
            if (!l["W.P_1"]) return;
            const parsedTime = l.wp1_parsed_date ? new Date(l.wp1_parsed_date).getTime() : 0;
            if (!inRange(parsedTime)) return;

            const tbl = l._source_table || l.fallbackTable || "master_leads";
            if (!tableMap[tbl]) {
                tableMap[tbl] = { name: tbl, reachouts: 0, replied: 0, color: "#64748b" };
            }
            tableMap[tbl].reachouts++;
            const v = l["WP_Replied_track"];
            if (v && String(v).trim() !== "" && String(v).trim().toLowerCase() !== "no") {
                tableMap[tbl].replied++;
            }
        });

        return Object.values(tableMap).filter(t => t.reachouts > 0 || t.replied > 0);
    }, [loopData, dateRange]);

    return (
        <div className="space-y-6 pb-10 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--label-primary)] flex items-center gap-2">
                        WhatsApp Analytics
                    </h1>
                    <p className="text-[var(--label-secondary)] text-sm">
                        Real-time metrics, temperature breakdown, and database table performance
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (dateRange?.from) fetchData(dateRange.from, dateRange.to || dateRange.from);
                        }}
                        className="h-10"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button
                        onClick={() => router.push('/dashboard/whatsapp/chat')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-10 shadow-sm"
                    >
                        <MessageSquare className="h-4 w-4" /> Go to Chat
                    </Button>
                </div>
            </div>

            {/* Primary KPI Cards */}
            <div>
                <p className="text-xs font-bold text-[var(--label-secondary)] uppercase tracking-wider mb-3">
                    Campaign & Activity Overview
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Messages Sent"
                        value={loading ? "..." : stats.sentCount.toLocaleString()}
                        icon={Send}
                        color="text-blue-600"
                        bg="bg-blue-50"
                        desc="Total outbound pulses"
                    />
                    <StatCard
                        title="Unique Leads Contacted"
                        value={loading ? "..." : stats.uniqueSentCount.toLocaleString()}
                        icon={Users}
                        color="text-slate-700"
                        bg="bg-slate-100"
                        info="Count of distinct leads with outbound WhatsApp activity in selected period."
                    />
                    <StatCard
                        title="Total Replies"
                        value={loading ? "..." : stats.totalReplies.toLocaleString()}
                        icon={MessageSquare}
                        color="text-emerald-600"
                        bg="bg-emerald-50"
                        desc="Incoming lead responses"
                    />
                    <StatCard
                        title="Response Rate"
                        value={loading ? "..." : `${replyRate}%`}
                        icon={TrendingUp}
                        color="text-purple-600"
                        bg="bg-purple-50"
                        desc="Replies / Unique Leads"
                    />
                </div>
            </div>

            {/* Lead Temperature Breakdown (Aligned with schema) */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-[var(--label-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                        <Flame className="h-4 w-4 text-rose-500" /> Lead Temperature Distribution
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/dashboard/whatsapp/leads')}
                        className="text-xs text-emerald-600 font-bold hover:underline"
                    >
                        View All Leads <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card
                        className="border-rose-100 bg-rose-50/50 hover:bg-rose-50 transition-colors cursor-pointer"
                        onClick={() => router.push('/dashboard/whatsapp/chat')}
                    >
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 uppercase">
                                    <Flame className="h-4 w-4 fill-rose-500 text-rose-500" /> Hot Leads
                                </div>
                                <h3 className="text-2xl font-bold text-rose-900 mt-1">{loading ? "..." : stats.tempCounts.hot}</h3>
                            </div>
                            <Badge className="bg-rose-100 text-rose-700 border-none font-bold">HOT 🔥</Badge>
                        </CardContent>
                    </Card>

                    <Card
                        className="border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition-colors cursor-pointer"
                        onClick={() => router.push('/dashboard/whatsapp/chat')}
                    >
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase">
                                    <Sun className="h-4 w-4 text-amber-500" /> Warm Leads
                                </div>
                                <h3 className="text-2xl font-bold text-amber-900 mt-1">{loading ? "..." : stats.tempCounts.warm}</h3>
                            </div>
                            <Badge className="bg-amber-100 text-amber-700 border-none font-bold">WARM ☀️</Badge>
                        </CardContent>
                    </Card>

                    <Card
                        className="border-blue-100 bg-blue-50/50 hover:bg-blue-50 transition-colors cursor-pointer"
                        onClick={() => router.push('/dashboard/whatsapp/chat')}
                    >
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase">
                                    <Snowflake className="h-4 w-4 text-blue-500" /> Cold Leads
                                </div>
                                <h3 className="text-2xl font-bold text-blue-900 mt-1">{loading ? "..." : stats.tempCounts.cold}</h3>
                            </div>
                            <Badge className="bg-blue-100 text-blue-700 border-none font-bold">COLD ❄️</Badge>
                        </CardContent>
                    </Card>

                    <Card
                        className="border-[var(--separator)] bg-[var(--glass-fill)] hover:bg-[var(--bg-app)] transition-colors cursor-pointer"
                        onClick={() => router.push('/dashboard/whatsapp/chat')}
                    >
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--label-secondary)] uppercase">
                                    <Users className="h-4 w-4 opacity-50" /> Unassigned
                                </div>
                                <h3 className="text-2xl font-bold text-[var(--label-primary)] mt-1">{loading ? "..." : stats.tempCounts.unassigned}</h3>
                            </div>
                            <Badge variant="outline" className="text-[10px] text-[var(--label-secondary)] uppercase font-bold">—</Badge>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Engagement Trend */}
                <Card className="lg:col-span-2 border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-[var(--label-primary)]">Engagement Trend</CardTitle>
                        <CardDescription className="text-xs">Outbound reachouts vs incoming replies per day</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.trendData}>
                                    <defs>
                                        <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorReplied" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
                                    <Area type="monotone" dataKey="sent" name="Reachouts" stroke="#3b82f6" strokeWidth={2} fill="url(#colorSent)" />
                                    <Area type="monotone" dataKey="replied" name="Replies" stroke="#10b981" strokeWidth={2} fill="url(#colorReplied)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Temperature Pie Chart */}
                <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)]">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-[var(--label-primary)] flex items-center justify-between">
                            <span>Temperature Share</span>
                            <Flame className="h-4 w-4 text-rose-500" />
                        </CardTitle>
                        <CardDescription className="text-xs">Distribution of leads by intent score</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3">
                        {loading ? (
                            <div className="h-[250px] flex items-center justify-center text-[var(--label-tertiary)] text-sm">
                                <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading...
                            </div>
                        ) : stats.tempData.length === 0 ? (
                            <div className="h-[250px] flex items-center justify-center text-[var(--label-tertiary)] text-sm">
                                No temperature data available
                            </div>
                        ) : (
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.tempData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {stats.tempData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Database Table & Activity Performance Section */}
            <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)] overflow-hidden">
                <CardHeader className="pb-3 border-b border-[var(--separator)] flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-bold text-[var(--label-primary)] flex items-center gap-2">
                            <Database className="h-4 w-4 text-emerald-600" /> Database Table Performance
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Reachout and reply breakdown by database tables (fello_activity, naples_activity, aspen_activity, old_activity, fello_leads, master_leads)
                        </CardDescription>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push('/dashboard/whatsapp/chat')}
                        className="text-xs gap-1.5 h-8"
                    >
                        <Eye className="h-3.5 w-3.5" /> View Chat Workspace
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full text-sm">
                        <thead className="bg-[var(--bg-app)] text-[var(--label-secondary)] font-bold border-b border-[var(--separator)]">
                            <tr>
                                <th className="px-4 py-3 text-left">Database Table</th>
                                <th className="px-4 py-3 text-center">Reachouts</th>
                                <th className="px-4 py-3 text-center">Replies</th>
                                <th className="px-4 py-3 text-center">Reply Rate</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--separator)]">
                            {tableBreakdown.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--label-tertiary)]">
                                        No table performance data available for this range.
                                    </td>
                                </tr>
                            ) : (
                                tableBreakdown.map(row => (
                                    <tr key={row.name} className="hover:bg-[var(--bg-app)] transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs font-bold text-[var(--label-primary)] flex items-center gap-2">
                                            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                                            {row.name}
                                        </td>
                                        <td className="px-4 py-3 text-center text-[var(--label-primary)] font-bold">{row.reachouts.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center text-emerald-600 font-bold">{row.replied.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center text-[var(--label-secondary)] font-bold">
                                            {row.reachouts > 0 ? `${((row.replied / row.reachouts) * 100).toFixed(1)}%` : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => router.push(`/dashboard/whatsapp/chat`)}
                                                className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7"
                                            >
                                                View Chats <ArrowUpRight className="h-3 w-3 ml-1" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, bg, desc, info }: any) {
    return (
        <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)] overflow-hidden relative">
            {info && (
                <div className="absolute top-2 right-2">
                    <TooltipProvider>
                        <UITooltip>
                            <TooltipTrigger asChild>
                                <div className="p-1 cursor-help hover:scale-110 transition-transform">
                                    <Info className="h-4 w-4 text-[var(--label-tertiary)] hover:text-[var(--label-secondary)]" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px] p-3 text-xs bg-slate-900 text-white border-none shadow-2xl rounded-xl">
                                <p className="font-bold mb-1">Note</p>
                                <p className="opacity-90 leading-relaxed">{info}</p>
                            </TooltipContent>
                        </UITooltip>
                    </TooltipProvider>
                </div>
            )}
            <CardContent className="p-4 flex items-center gap-3.5">
                <div className={`p-3 rounded-xl ${bg} ${color} shrink-0`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-[var(--label-secondary)] uppercase tracking-wider">{title}</p>
                    <h3 className="text-xl font-bold text-[var(--label-primary)] mt-0.5">{value}</h3>
                    {desc && <p className="text-[10px] text-[var(--label-tertiary)] mt-0.5">{desc}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

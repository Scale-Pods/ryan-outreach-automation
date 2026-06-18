"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    BarChart,
    Bar,
    Cell,
    Legend,
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { TrendingUp, Users, MessageSquare, Send, RefreshCw, Building2, Info, Reply } from "lucide-react";
import {
    Tooltip as UITooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { LMLoader } from "@/components/lm-loader";


export default function WhatsappAnalyticsPage() {
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: subDays(new Date(), 7),
        to: new Date()
    });

    const [loopData, setLoopData] = useState<{ nr_wf: any[]; followup: any[]; nurture: any[]; owners: any[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async (from: Date, to: Date) => {
        setLoading(true);
        const fromISO = startOfDay(from).toISOString();
        const toISO = endOfDay(to).toISOString();
        fetch(`/api/whatsapp-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setLoopData(d); })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchData(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchData]);

    // Compute all metrics client-side — same logic as dashboard and chat pages
    const stats = useMemo(() => {
        if (!loopData) return { uniqueSentCount: 0, sentCount: 0, totalReplies: 0, ownerReachouts: 0, ownerReplies: 0, trendData: [] as any[] };

        const allLeads = [
            ...(loopData.nr_wf || []),
            ...(loopData.followup || []),
            ...(loopData.nurture || []),
        ];

        const from = dateRange?.from ? startOfDay(dateRange.from).getTime() : null;
        const to = endOfDay(dateRange?.to || dateRange?.from || new Date()).getTime();
        const inRange = (t: number) => !from || (t >= from && t <= to);

        let uniqueSentCount = 0;
        let sentCount = 0;
        let totalReplies = 0;
        const dailyMap: Record<string, { reachouts: number; replies: number }> = {};

        // Only leads where W.P_1 was sent within the selected date range
        const inRangeLeads = allLeads.filter(lead => {
            if (!lead["W.P_1"]) return false;
            if (!lead.wp1_parsed_date) return true;
            return inRange(new Date(lead.wp1_parsed_date).getTime());
        });

        uniqueSentCount = inRangeLeads.length;

        inRangeLeads.forEach(lead => {
            // Messages Sent: all filled WP slots on this in-range lead
            for (let i = 1; i <= 12; i++) {
                if (lead[`W.P_${i}`]) sentCount++;
            }
            if (lead["W.P_FollowUp"]) sentCount++;
            for (let i = 1; i <= 10; i++) {
                if (lead[`W.P_FollowUp_${i}`] || lead[`W.P_FollowUp ${i}`]) sentCount++;
            }

            const wp = lead.WP_Replied_track || lead["WP_Replied_track"];
            const hasReplied = !!(wp && String(wp).trim() && String(wp).trim().toLowerCase() !== "no" && String(wp).trim().toLowerCase() !== "none");
            if (hasReplied) totalReplies++;

            if (lead.wp1_parsed_date) {
                const dayKey = new Date(lead.wp1_parsed_date).toISOString().slice(0, 10);
                if (!dailyMap[dayKey]) dailyMap[dayKey] = { reachouts: 0, replies: 0 };
                dailyMap[dayKey].reachouts++;
                if (hasReplied) dailyMap[dayKey].replies++;
            }
        });

        const owners = loopData.owners ?? [];
        const ownerReachouts = owners.filter(o => o["Whatsapp_1"]).length;
        const ownerReplies = owners.filter(o => {
            const v = o["WTS_Reply_Track"];
            return v && String(v).trim() && String(v).trim().toLowerCase() !== "no";
        }).length;

        const trendData = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, { reachouts, replies }]) => ({
                date: format(new Date(date + 'T00:00:00'), 'MMM dd'),
                sent: reachouts,
                replied: replies,
            }));

        return { uniqueSentCount, sentCount, totalReplies, ownerReachouts, ownerReplies, trendData };
    }, [loopData, dateRange]);

    const replyRate = stats.uniqueSentCount > 0
        ? ((stats.totalReplies / stats.uniqueSentCount) * 100).toFixed(1)
        : "0.0";
    const ownerReplyRate = stats.ownerReachouts > 0
        ? ((stats.ownerReplies / stats.ownerReachouts) * 100).toFixed(1)
        : "0.0";

    // Per-loop breakdown — unique reachouts (W.P_1 in range) per loop
    const loopBreakdown = useMemo(() => {
        if (!loopData) return [];
        const from = dateRange?.from ? startOfDay(dateRange.from).getTime() : null;
        const to = endOfDay(dateRange?.to || dateRange?.from || new Date()).getTime();
        const inRange = (t: number) => !from || (t >= from && t <= to);

        const summarise = (arr: any[], color: string, name: string) => {
            const reachouts = arr.filter(l =>
                l["W.P_1"] && (l.wp1_parsed_date ? inRange(new Date(l.wp1_parsed_date).getTime()) : true)
            ).length;
            const replied = arr.filter(l => {
                const v = l["WP_Replied_track"];
                return v && String(v).trim() !== "" && String(v).trim().toLowerCase() !== "no";
            }).length;
            return { name, reachouts, replied, color };
        };

        return [
            summarise(loopData.nr_wf ?? [], "#3b82f6", "Intro (nr_wf)"),
            summarise(loopData.followup ?? [], "#8b5cf6", "Follow Up"),
            summarise(loopData.nurture ?? [], "#f59e0b", "Nurture"),
        ];
    }, [loopData, dateRange]);

    const totalUniqueLeads = stats.uniqueSentCount;

    return (
        <div className="space-y-4 pb-4 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">WhatsApp Analytics</h1>
                    <p className="text-slate-500 text-sm">Track campaign performance and lead engagement</p>
                </div>
                <div className="flex items-center gap-2">
                    <DateRangePicker onUpdate={({ range }) => setDateRange({ from: range?.from, to: range?.to })} />
                    <Button variant="outline" size="sm" onClick={() => {
                        if (dateRange?.from) fetchData(dateRange.from, dateRange.to || dateRange.from);
                    }} className="h-10">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Core Metrics — Leads */}
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Lead Campaigns (nr_wf · followup · nurture)</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                        title="Messages Sent"
                        value={loading ? "..." : stats.sentCount.toLocaleString()}
                        icon={Send}
                        color="text-blue-600"
                        bg="bg-blue-50"
                    />
                    <StatCard
                        title="Unique Msg Sent"
                        value={loading ? "..." : totalUniqueLeads.toLocaleString()}
                        icon={Users}
                        color="text-slate-600"
                        bg="bg-slate-50"
                        info="Count of unique leads where W.P_1 was sent within the selected date range."
                    />
                    <StatCard
                        title="Total Replies"
                        value={loading ? "..." : stats.totalReplies.toLocaleString()}
                        icon={MessageSquare}
                        color="text-emerald-600"
                        bg="bg-emerald-50"
                        info="Derived from WP_Replied_track. Feature installed recently — select Last 3 Months for historical data."
                    />
                    <StatCard
                        title="Response Rate"
                        value={loading ? "..." : `${replyRate}%`}
                        icon={TrendingUp}
                        color="text-purple-600"
                        bg="bg-purple-50"
                    />
                </div>
            </div>

            {/* Owner Analytics */}
            <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-amber-500" /> Owner Campaigns
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard
                        title="Owner Reachouts"
                        value={loading ? "..." : stats.ownerReachouts.toLocaleString()}
                        icon={Building2}
                        color="text-amber-600"
                        bg="bg-amber-50"
                    />
                    <StatCard
                        title="Owner Replies"
                        value={loading ? "..." : stats.ownerReplies.toLocaleString()}
                        icon={Reply}
                        color="text-emerald-600"
                        bg="bg-emerald-50"
                    />
                    <StatCard
                        title="Owner Reply Rate"
                        value={loading ? "..." : `${ownerReplyRate}%`}
                        icon={TrendingUp}
                        color="text-purple-600"
                        bg="bg-purple-50"
                    />
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Engagement Trend */}
                <Card className="lg:col-span-2 border-slate-200 shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-slate-900">Engagement Trend</CardTitle>
                        <CardDescription className="text-xs">Outbound reachouts vs incoming replies per day</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3">
                        <div className="h-[240px] w-full">
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

                {/* Loop Breakdown */}
                <Card className="border-slate-200 shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-slate-900">Loop Breakdown</CardTitle>
                        <CardDescription className="text-xs">Reachouts and replies by campaign loop</CardDescription>
                    </CardHeader>
                    <CardContent className="p-3">
                        {loading ? (
                            <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">
                                <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading...
                            </div>
                        ) : loopBreakdown.every(l => l.reachouts === 0) ? (
                            <div className="h-[240px] flex items-center justify-center text-slate-400 text-sm">
                                No data for this period
                            </div>
                        ) : (
                            <div className="h-[240px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={loopBreakdown} layout="vertical" margin={{ left: 8, right: 16 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={72} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                                        <Bar dataKey="reachouts" name="Reachouts" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
                                        <Bar dataKey="replied" name="Replied" fill="#10b981" radius={[0, 4, 4, 0]} barSize={14} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Loop Detail Table */}
            {!loading && loopBreakdown.some(l => l.reachouts > 0) && (
                <Card className="border-slate-200 shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-slate-900">Loop Performance</CardTitle>
                        <CardDescription className="text-xs">Per-loop reachout and reply breakdown</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-3 text-left">Loop</th>
                                    <th className="px-4 py-3 text-center">Reachouts</th>
                                    <th className="px-4 py-3 text-center">Replies</th>
                                    <th className="px-4 py-3 text-center">Reply Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loopBreakdown.map(row => (
                                    <tr key={row.name} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-bold text-slate-700">
                                            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: row.color }} />
                                            {row.name}
                                        </td>
                                        <td className="px-4 py-3 text-center text-slate-700 font-bold">{row.reachouts.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center text-emerald-600 font-bold">{row.replied.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center text-slate-500 font-bold">
                                            {row.reachouts > 0 ? `${((row.replied / row.reachouts) * 100).toFixed(1)}%` : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function StatCard({ title, value, icon: Icon, color, bg, info }: any) {
    return (
        <Card className="border-slate-200 shadow-sm bg-white overflow-hidden relative">
            {info && (
                <div className="absolute top-2 right-2">
                    <TooltipProvider>
                        <UITooltip>
                            <TooltipTrigger asChild>
                                <div className="p-1 cursor-help hover:scale-110 transition-transform">
                                    <Info className="h-6 w-6 text-red-500 fill-red-50" strokeWidth={2.5} />
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
            <CardContent className="p-3.5 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${bg} ${color}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
                    <h3 className="text-lg font-bold text-slate-900">{value}</h3>
                </div>
            </CardContent>
        </Card>
    );
}

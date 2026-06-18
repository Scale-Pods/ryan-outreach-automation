"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Users,
    MessageCircle,
    TrendingUp,
    BarChart3,
    Send,
    Building2,
    MessageSquare,
    Info
} from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    LineChart,
    Line
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import {
    Tooltip as UITooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { LMLoader } from "@/components/lm-loader";

export default function WhatsappDashboardPage() {
    const router = useRouter();

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date()
    });
    const [waData, setWaData] = useState<{ nr_wf: any[], followup: any[], nurture: any[], owners: any[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const fromISO = startOfDay(from).toISOString();
            const toISO = endOfDay(to).toISOString();
            const res = await fetch(`/api/whatsapp-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
            if (res.ok) setWaData(await res.json());
        } catch (e) {
            console.error('[WA dashboard]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchData(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchData]);

    // Compute metrics:
    // Unique Msg Sent = leads whose W.P_1 was sent in range (wp1_parsed_date).
    // Messages Sent   = total filled WP slots on those in-range leads.
    // Total Replies   = all leads with a reply tracked.
    const stats = useMemo(() => {
        if (!waData) return { totalLeads: 0, sentCount: 0, uniqueSentCount: 0, totalReplies: 0, ownerReachouts: 0, ownerReplies: 0, ownerSent: 0, dailyTrend: [] as any[] };

        const allLeads = [
            ...(waData.nr_wf || []),
            ...(waData.followup || []),
            ...(waData.nurture || []),
        ];

        const from = dateRange?.from ? startOfDay(new Date(dateRange.from)).getTime() : null;
        const to = endOfDay(new Date(dateRange?.to || dateRange?.from || new Date())).getTime();
        const inRange = (t: number) => !from || (t >= from && t <= to);

        // Only leads where W.P_1 was sent within the selected date range
        const inRangeLeads = allLeads.filter(lead => {
            if (!lead["W.P_1"]) return false;
            if (!lead.wp1_parsed_date) return true;
            return inRange(new Date(lead.wp1_parsed_date).getTime());
        });

        let sentCount = 0;
        let uniqueSentCount = inRangeLeads.length;
        let totalReplies = 0;
        const dailyMap: Record<string, { reachouts: number; replies: number }> = {};

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

            // Daily trend bucketed by wp1_parsed_date
            if (lead.wp1_parsed_date) {
                const dayKey = new Date(lead.wp1_parsed_date).toISOString().slice(0, 10);
                if (!dailyMap[dayKey]) dailyMap[dayKey] = { reachouts: 0, replies: 0 };
                dailyMap[dayKey].reachouts++;
                if (hasReplied) dailyMap[dayKey].replies++;
            }
        });

        const dailyTrend = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, vals]) => ({ date, ...vals }));

        // Owner stats
        const owners = waData.owners || [];
        const ownerReachouts = owners.filter(o => o["Whatsapp_1"] || o.Whatsapp_1).length;
        let ownerSent = 0;
        let ownerReplies = 0;
        owners.forEach(o => {
            if (o["Whatsapp_1"]) ownerSent++;
            if (o["retry_1"]) ownerSent++;
            for (let i = 1; i <= 5; i++) { if (o[`Bot_Replied_${i}`]) ownerSent++; }
            const wts = o["WTS_Reply_Track"];
            if (wts && wts !== "" && String(wts).toLowerCase() !== "no") ownerReplies++;
        });

        return { totalLeads: allLeads.length, sentCount, uniqueSentCount, totalReplies, ownerReachouts, ownerReplies, ownerSent, dailyTrend };
    }, [waData]);

    const trendData = useMemo(() => stats.dailyTrend.map(d => ({
        date: format(new Date(d.date + 'T00:00:00'), 'MMM dd'),
        sent: d.reachouts,
        replied: d.replies,
    })), [stats.dailyTrend]);

    const donutData = [
        { name: 'Unique Msg Sent', value: stats.uniqueSentCount, color: '#8b5cf6' },
        { name: 'Messages Sent', value: stats.sentCount, color: '#3b82f6' },
        { name: 'Total Replies', value: stats.totalReplies, color: '#10b981' },
    ];

    return (
        <div className="space-y-3 pb-3 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">WhatsApp Overview</h1>
                    <p className="text-slate-500 text-sm">Real-time engagement insights and campaign totals</p>
                </div>
                <DateRangePicker onUpdate={(range) => setDateRange(range.range)} />
            </div>

            {/* Normal Lead Metrics — 3 cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <MetricCard
                    title="Unique Msg Sent"
                    value={loading ? "..." : stats.uniqueSentCount.toLocaleString()}
                    icon={Users}
                    theme="purple"
                    onClick={() => router.push('/dashboard/whatsapp/leads')}
                />
                <MetricCard
                    title="Total Replies"
                    value={loading ? "..." : stats.totalReplies.toLocaleString()}
                    icon={MessageCircle}
                    theme="emerald"
                    info="This count is derived from the 'WP_Replied_track' column. Disclaimer: This feature has been installed now. To check original reply counts, please select the 'Last 3 Months' filter."
                />
                <MetricCard
                    title="Messages Sent"
                    value={loading ? "..." : stats.sentCount.toLocaleString()}
                    icon={Send}
                    theme="blue"
                />
            </div>

            {/* Owner Metrics — 3 cards */}
            <div>
                <h2 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-amber-500" /> Owner Metrics
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <MetricCard
                        title="Owner Reachouts"
                        value={loading ? "..." : stats.ownerReachouts.toLocaleString()}
                        icon={Building2}
                        theme="amber"
                        onClick={() => router.push('/dashboard/whatsapp/chat?tab=owners')}
                    />
                    <MetricCard
                        title="Owner Replies"
                        value={loading ? "..." : stats.ownerReplies.toLocaleString()}
                        icon={MessageSquare}
                        theme="emerald"
                    />
                    <MetricCard
                        title="Owner Messages Sent"
                        value={loading ? "..." : stats.ownerSent.toLocaleString()}
                        icon={Send}
                        theme="amber"
                    />
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-slate-500" />
                            <CardTitle className="text-sm font-bold text-slate-700 uppercase">Conversion Funnel</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="w-full" style={{ height: 200, minHeight: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={65}
                                        outerRadius={95}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {donutData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <SummaryPill label="Unique Msg Sent" value={stats.uniqueSentCount} color="bg-purple-600" />
                            <SummaryPill label="Messages Sent" value={stats.sentCount} color="bg-blue-600" />
                            <SummaryPill label="Total Replies" value={stats.totalReplies} color="bg-emerald-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-slate-500" />
                            <CardTitle className="text-sm font-bold text-slate-700 uppercase">Activity Trend</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="w-full" style={{ height: 200, minHeight: 200 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                    <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                    <Line type="monotone" dataKey="replied" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-8 mt-4">
                            <div className="flex items-center gap-2">
                                <div className="h-1 w-4 bg-blue-600 rounded-full" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Messages Sent</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-1 w-4 bg-emerald-600 rounded-full" />
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Replies Received</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}

function MetricCard({ title, value, icon: Icon, theme, onClick, info }: any) {
    const themes: any = {
        purple: { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100", iconBg: "bg-purple-100/50" },
        blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100", iconBg: "bg-blue-100/50" },
        emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100", iconBg: "bg-emerald-100/50" },
        amber: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100", iconBg: "bg-amber-100/50" },
    };
    const t = themes[theme] || themes.purple;

    return (
        <Card
            className={`border ${t.border} shadow-sm bg-white overflow-hidden relative ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 transition-all active:scale-[0.98]' : ''}`}
            onClick={onClick}
        >
            {info && (
                <div className="absolute top-2 right-2">
                    <TooltipProvider>
                        <UITooltip>
                            <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <div className="p-1 cursor-help hover:scale-110 transition-transform">
                                    <Info className="h-7 w-7 text-red-500 fill-red-50" strokeWidth={2.5} />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[250px] p-3 text-xs bg-slate-900 text-white border-none shadow-2xl rounded-xl">
                                <p className="font-bold mb-1">Important Note</p>
                                <p className="opacity-90 leading-relaxed">{info}</p>
                            </TooltipContent>
                        </UITooltip>
                    </TooltipProvider>
                </div>
            )}
            <CardContent className="p-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${t.iconBg} ${t.text}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function SummaryPill({ label, value, color }: any) {
    return (
        <div className={`p-3 rounded-xl flex flex-col items-center justify-center text-white ${color} shadow-sm`}>
            <span className="text-xl font-black">{value}</span>
            <span className="text-[9px] uppercase font-bold opacity-90 text-center leading-tight tracking-wider">{label}</span>
        </div>
    );
}

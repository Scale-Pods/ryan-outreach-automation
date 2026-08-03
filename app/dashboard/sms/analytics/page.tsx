"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    BarChart3,
    TrendingUp,
    Clock,
    CheckCircle2,
    Users,
    Activity,
    Smartphone,
    MessageSquare,
    Send,
    Flame,
    Sun,
    Snowflake,
    Filter,
    RefreshCw
} from "lucide-react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line
} from "recharts";
import { useState, useEffect, useMemo, useCallback } from "react";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { LMLoader } from "@/components/ryan-loader";

export default function SmsAnalyticsPage() {
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 90),
        to: new Date()
    });
    const [smsData, setSmsData] = useState<{ sms_activity: any[], sms_leads: any[], total: number } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = useCallback(async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const fromISO = startOfDay(from).toISOString();
            const toISO = endOfDay(to).toISOString();
            const res = await fetch(`/api/sms-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
            if (res.ok) setSmsData(await res.json());
        } catch (e) {
            console.error('[SMS Analytics fetch]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchAnalytics(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchAnalytics]);

    // Compute strictly SMS-related analytics
    const stats = useMemo(() => {
        if (!smsData) {
            return {
                uniqueSentCount: 0,
                totalSent: 0,
                totalReplies: 0,
                replyRate: '0.0',
                deliveryRate: '100%',
                dailyTrend: [] as any[],
                tempData: [] as any[],
                tempCounts: { hot: 0, warm: 0, cold: 0, unassigned: 0 },
                statusCounts: { sent: 0, delivered: 0, replied: 0, failed: 0 },
                campaignCounts: [] as any[]
            };
        }

        const activities = smsData.sms_activity || [];
        const leads = smsData.sms_leads || [];

        const from = dateRange?.from ? startOfDay(new Date(dateRange.from)).getTime() : null;
        const to = endOfDay(new Date(dateRange?.to || dateRange?.from || new Date())).getTime();
        const inRange = (t: number) => !from || (t >= from && t <= to);

        // Filter SMS activities strictly within date range
        const inRangeActivities = activities.filter(act => {
            const t = act.created_at || act.created_date;
            if (!t) return true;
            return inRange(new Date(t).getTime());
        });

        const totalSent = inRangeActivities.length;
        const uniquePhones = new Set(inRangeActivities.map(a => a.lead_phone || a.phone || a.lead_id)).size;
        const uniqueSentCount = Math.max(uniquePhones, leads.length);

        let totalReplies = 0;
        let deliveredCount = 0;

        const dailyMap: Record<string, { sent: number; replies: number }> = {};
        const tempCounts = { hot: 0, warm: 0, cold: 0, unassigned: 0 };
        const statusCounts = { sent: 0, delivered: 0, replied: 0, failed: 0 };
        const campaignMap: Record<string, { sent: number; replies: number }> = {};

        inRangeActivities.forEach(act => {
            const isReply = act.action_type === 'reply' || act.status === 'replied' || act.replied_at;
            if (isReply) {
                totalReplies++;
                statusCounts.replied++;
            } else if (act.status === 'delivered') {
                deliveredCount++;
                statusCounts.delivered++;
            } else if (act.status === 'failed' || act.status === 'error') {
                statusCounts.failed++;
            } else {
                statusCounts.sent++;
            }

            // Temperature / Lead Interest classification
            const temp = (act.lead_temp || act.sentiment || "").toLowerCase();
            if (temp === 'hot' || temp === 'fire') tempCounts.hot++;
            else if (temp === 'warm') tempCounts.warm++;
            else if (temp === 'cold') tempCounts.cold++;
            else tempCounts.unassigned++;

            // Campaign loop breakdown
            const loopName = act.campaign || act.source_loop || "SMS Campaign";
            if (!campaignMap[loopName]) campaignMap[loopName] = { sent: 0, replies: 0 };
            campaignMap[loopName].sent++;
            if (isReply) campaignMap[loopName].replies++;

            // Daily trend mapping
            const dateSource = act.created_at || act.created_date;
            if (dateSource) {
                const dayKey = format(new Date(dateSource), 'MMM dd');
                if (!dailyMap[dayKey]) dailyMap[dayKey] = { sent: 0, replies: 0 };
                dailyMap[dayKey].sent++;
                if (isReply) dailyMap[dayKey].replies++;
            }
        });

        const dailyTrend = Object.entries(dailyMap).map(([day, vals]) => ({ day, ...vals }));
        const replyRate = uniqueSentCount > 0 ? ((totalReplies / uniqueSentCount) * 100).toFixed(1) : '0.0';
        const deliveryRate = totalSent > 0 ? (((totalSent - statusCounts.failed) / totalSent) * 100).toFixed(1) + '%' : '100%';

        const totalTemps = tempCounts.hot + tempCounts.warm + tempCounts.cold || 1;
        const tempData = [
            { name: 'Hot 🔥', value: tempCounts.hot, pct: Math.round((tempCounts.hot / totalTemps) * 100), color: '#f43f5e' },
            { name: 'Warm ☀️', value: tempCounts.warm, pct: Math.round((tempCounts.warm / totalTemps) * 100), color: '#f59e0b' },
            { name: 'Cold ❄️', value: tempCounts.cold, pct: Math.round((tempCounts.cold / totalTemps) * 100), color: '#3b82f6' },
        ];

        const campaignCounts = Object.entries(campaignMap).map(([name, data]) => ({
            name,
            sent: data.sent,
            replies: data.replies,
            rate: data.sent > 0 ? ((data.replies / data.sent) * 100).toFixed(1) : '0.0'
        }));

        return {
            uniqueSentCount,
            totalSent,
            totalReplies,
            replyRate,
            deliveryRate,
            dailyTrend,
            tempData,
            tempCounts,
            statusCounts,
            campaignCounts
        };
    }, [smsData, dateRange]);

    return (
        <div className="space-y-6 pb-6 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--label-primary)] tracking-tight flex items-center gap-2">
                        <BarChart3 className="h-6 w-6 text-amber-400" />
                        SMS Campaign Analytics
                    </h1>
                    <p className="text-[var(--label-secondary)] text-sm">Strictly SMS-related conversion rates, delivery status, and engagement telemetry</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => fetchAnalytics(dateRange.from, dateRange.to || dateRange.from)}
                        className="text-slate-300 hover:bg-white/10 rounded-xl h-10 w-10"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <DateRangePicker onUpdate={(range) => setDateRange(range.range)} />
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-lg">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SMS Delivery Rate</p>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        </div>
                        <h3 className="text-3xl font-black text-emerald-400 mt-2">{stats.deliveryRate}</h3>
                        <p className="text-xs text-slate-400 mt-1">Carrier delivery success rate</p>
                    </CardContent>
                </Card>

                <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-lg">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SMS Response Rate</p>
                            <TrendingUp className="h-4 w-4 text-amber-400" />
                        </div>
                        <h3 className="text-3xl font-black text-amber-400 mt-2">{stats.replyRate}%</h3>
                        <p className="text-xs text-slate-400 mt-1">Lead reply engagement rate</p>
                    </CardContent>
                </Card>

                <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-lg">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Outbound SMS</p>
                            <Send className="h-4 w-4 text-blue-400" />
                        </div>
                        <h3 className="text-3xl font-black text-blue-400 mt-2">{stats.totalSent}</h3>
                        <p className="text-xs text-slate-400 mt-1">Total SMS messages dispatched</p>
                    </CardContent>
                </Card>

                <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-lg">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SMS Inbound Replies</p>
                            <MessageSquare className="h-4 w-4 text-purple-400" />
                        </div>
                        <h3 className="text-3xl font-black text-purple-400 mt-2">{stats.totalReplies}</h3>
                        <p className="text-xs text-slate-400 mt-1">Inbound SMS replies captured</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Performance Bar Chart */}
                <Card className="lg:col-span-2 bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-white flex items-center justify-between">
                            <span>SMS Sent vs Replies Over Time</span>
                            <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs">SMS Telemetry</Badge>
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-xs">Daily outbound SMS volume compared against inbound lead replies</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 h-[320px]">
                        {stats.dailyTrend.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                                No SMS performance records available for the selected date range.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.dailyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 12 }} />
                                    <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                                    <Bar dataKey="sent" name="Outbound SMS" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="replies" name="Inbound Replies" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Lead Sentiment Distribution */}
                <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-white">SMS Lead Sentiment</CardTitle>
                        <CardDescription className="text-slate-400 text-xs">Interest classification of SMS contacts</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 flex flex-col items-center justify-center h-[320px]">
                        <ResponsiveContainer width="100%" height={190}>
                            <PieChart>
                                <Pie
                                    data={stats.tempData}
                                    innerRadius={55}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stats.tempData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="grid grid-cols-3 gap-2 w-full mt-2 text-center">
                            {stats.tempData.map((d, i) => (
                                <div key={i} className="flex flex-col items-center">
                                    <span className="w-2.5 h-2.5 rounded-full mb-1" style={{ backgroundColor: d.color }} />
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">{d.name}</span>
                                    <span className="text-sm font-bold text-white">{d.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* SMS Campaign Loop Breakdown Table */}
            <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-xl">
                <CardHeader>
                    <CardTitle className="text-lg font-bold text-white">SMS Campaign Performance Breakdown</CardTitle>
                    <CardDescription className="text-slate-400 text-xs">Conversion and engagement rate metrics by specific SMS campaign loop</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/[0.03] text-slate-400 text-xs uppercase tracking-wider font-semibold">
                                    <th className="py-3 px-4">Campaign Loop Name</th>
                                    <th className="py-3 px-4">Outbound SMS Dispatched</th>
                                    <th className="py-3 px-4">Replies Received</th>
                                    <th className="py-3 px-4 text-right">Conversion Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-slate-200">
                                {stats.campaignCounts.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">
                                            No active SMS campaigns found in this period.
                                        </td>
                                    </tr>
                                ) : (
                                    stats.campaignCounts.map((camp, idx) => (
                                        <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                                                <Smartphone className="h-4 w-4 text-amber-400" />
                                                {camp.name}
                                            </td>
                                            <td className="py-3.5 px-4 font-mono text-slate-300">
                                                {camp.sent}
                                            </td>
                                            <td className="py-3.5 px-4 font-mono text-emerald-400 font-bold">
                                                {camp.replies}
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                                                    {camp.rate}%
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

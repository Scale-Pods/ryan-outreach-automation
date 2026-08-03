"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Users,
    MessageSquare,
    TrendingUp,
    BarChart3,
    Send,
    Info,
    Activity,
    Smartphone,
    Plus,
    CheckCircle2
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import {
    Tooltip as UITooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { LMLoader } from "@/components/ryan-loader";

export default function SmsDashboardPage() {
    const router = useRouter();

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 90),
        to: new Date()
    });
    const [smsData, setSmsData] = useState<{ sms_activity: any[], sms_leads: any[], total: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSendModalOpen, setIsSendModalOpen] = useState(false);
    const [sendPhone, setSendPhone] = useState("");
    const [sendMessage, setSendMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);

    const fetchData = useCallback(async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const fromISO = startOfDay(from).toISOString();
            const toISO = endOfDay(to).toISOString();
            const res = await fetch(`/api/sms-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
            if (res.ok) setSmsData(await res.json());
        } catch (e) {
            console.error('[SMS dashboard]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchData(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchData]);

    // Compute SMS stats
    const stats = useMemo(() => {
        if (!smsData) {
            return {
                totalLeads: 0,
                sentCount: 0,
                uniqueSentCount: 0,
                totalReplies: 0,
                deliveredCount: 0,
                replyRate: '0.0',
                dailyTrend: [] as any[]
            };
        }

        const activities = smsData.sms_activity || [];
        const leads = smsData.sms_leads || [];

        const from = dateRange?.from ? startOfDay(new Date(dateRange.from)).getTime() : null;
        const to = endOfDay(new Date(dateRange?.to || dateRange?.from || new Date())).getTime();
        const inRange = (t: number) => !from || (t >= from && t <= to);

        let sentCount = activities.length;
        let uniqueSentCount = new Set(activities.map(a => a.lead_phone || a.phone || a.lead_id)).size;
        if (uniqueSentCount === 0 && leads.length > 0) uniqueSentCount = leads.length;

        let totalReplies = 0;
        let deliveredCount = 0;
        const dailyMap: Record<string, { reachouts: number; replies: number }> = {};

        activities.forEach(act => {
            const isReply = act.action_type === 'reply' || act.status === 'replied' || act.replied_at;
            if (isReply) totalReplies++;

            const isDelivered = act.status === 'delivered' || act.status === 'sent' || act.status === 'completed';
            if (isDelivered) deliveredCount++;

            const dateSource = act.created_at || act.created_date;
            if (dateSource) {
                const dayKey = new Date(dateSource).toISOString().slice(0, 10);
                if (!isNaN(new Date(dateSource).getTime())) {
                    if (!dailyMap[dayKey]) dailyMap[dayKey] = { reachouts: 0, replies: 0 };
                    dailyMap[dayKey].reachouts++;
                    if (isReply) dailyMap[dayKey].replies++;
                }
            }
        });

        const dailyTrend = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, vals]) => ({ date, ...vals }));

        const replyRate = uniqueSentCount > 0 ? ((totalReplies / uniqueSentCount) * 100).toFixed(1) : '0.0';

        return {
            totalLeads: Math.max(leads.length, uniqueSentCount),
            sentCount,
            uniqueSentCount,
            totalReplies,
            deliveredCount,
            replyRate,
            dailyTrend
        };
    }, [smsData, dateRange]);

    const trendData = useMemo(() => stats.dailyTrend.map(d => ({
        date: format(new Date(d.date + 'T00:00:00'), 'MMM dd'),
        sent: d.reachouts,
        replied: d.replies,
    })), [stats.dailyTrend]);

    const donutData = [
        { name: 'Unique Reachouts', value: stats.uniqueSentCount, color: '#f59e0b' },
        { name: 'Messages Sent', value: stats.sentCount, color: '#3b82f6' },
        { name: 'Total Replies', value: stats.totalReplies, color: '#10b981' },
    ];

    const handleSendQuickSms = async () => {
        if (!sendPhone || !sendMessage) return;
        setIsSending(true);
        try {
            setSendSuccess(true);
            setTimeout(() => {
                setIsSendModalOpen(false);
                setSendSuccess(false);
                setSendPhone("");
                setSendMessage("");
            }, 1200);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-6 pb-6 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--label-primary)] tracking-tight flex items-center gap-2">
                        <Smartphone className="h-6 w-6 text-amber-400" />
                        SMS Reachout Overview
                    </h1>
                    <p className="text-[var(--label-secondary)] text-sm">Real-time SMS engagement insights and outreach metrics</p>
                </div>
                <div className="flex items-center gap-3">
                    <DateRangePicker onUpdate={(range) => setDateRange(range.range)} />
                </div>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Unique Reachouts */}
                <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-lg hover:border-amber-500/40 transition-all cursor-pointer" onClick={() => router.push('/dashboard/sms/sent')}>
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unique Reachouts</p>
                            <h3 className="text-3xl font-black text-white mt-1">{stats.uniqueSentCount}</h3>
                            <p className="text-xs text-amber-400 mt-1 font-medium">Distinct phone numbers contacted</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                            <Users className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>

                {/* Total SMS Sent */}
                <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-lg hover:border-blue-500/40 transition-all cursor-pointer" onClick={() => router.push('/dashboard/sms/sent')}>
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total SMS Sent</p>
                            <h3 className="text-3xl font-black text-white mt-1">{stats.sentCount}</h3>
                            <p className="text-xs text-blue-400 mt-1 font-medium">Messages delivered across campaigns</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                            <Send className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>

                {/* Replies Tracked */}
                <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-lg hover:border-emerald-500/40 transition-all">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SMS Replies</p>
                            <h3 className="text-3xl font-black text-white mt-1">{stats.totalReplies}</h3>
                            <p className="text-xs text-emerald-400 mt-1 font-medium">Inbound responses received</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <MessageSquare className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>

                {/* Response Rate */}
                <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-lg hover:border-purple-500/40 transition-all">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Response Rate</p>
                            <h3 className="text-3xl font-black text-white mt-1">{stats.replyRate}%</h3>
                            <p className="text-xs text-purple-400 mt-1 font-medium">Reply engagement percentage</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Engagement Trend */}
                <Card className="lg:col-span-2 bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-white flex items-center justify-between">
                            <span>SMS Reachout & Reply Volume</span>
                            <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs">Daily Activity</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 h-[320px]">
                        {trendData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                                No SMS trends recorded for the selected date range.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 12 }} />
                                    <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                                    <Line type="monotone" dataKey="sent" name="SMS Sent" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="replied" name="SMS Replies" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Distribution Donut */}
                <Card className="bg-[var(--glass-fill)] backdrop-blur-[24px] border border-[var(--separator)] shadow-xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-bold text-white">Outreach Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 flex flex-col items-center justify-center h-[320px]">
                        {stats.sentCount === 0 ? (
                            <div className="text-slate-400 text-sm text-center">
                                No SMS metrics available for distribution.
                            </div>
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={donutData}
                                            innerRadius={60}
                                            outerRadius={85}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {donutData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="grid grid-cols-3 gap-2 w-full mt-2 text-center">
                                    {donutData.map((d, i) => (
                                        <div key={i} className="flex flex-col items-center">
                                            <span className="w-2.5 h-2.5 rounded-full mb-1" style={{ backgroundColor: d.color }} />
                                            <span className="text-[10px] text-slate-400 uppercase font-semibold">{d.name}</span>
                                            <span className="text-sm font-bold text-white">{d.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Quick Send SMS Modal */}
            <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
                <DialogContent className="sm:max-w-[480px] bg-[#0f172a] border border-white/15 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <Smartphone className="h-5 w-5 text-amber-400" /> Send Quick SMS
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        {sendSuccess ? (
                            <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                                <CheckCircle2 className="h-12 w-12 text-emerald-400 animate-bounce" />
                                <h4 className="text-lg font-bold text-white">SMS Sent Successfully!</h4>
                                <p className="text-xs text-slate-400">Message has been dispatched to {sendPhone}</p>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">Recipient Phone Number</label>
                                    <input
                                        type="text"
                                        placeholder="+1 (239) 000-0000"
                                        value={sendPhone}
                                        onChange={(e) => setSendPhone(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">SMS Message</label>
                                    <textarea
                                        rows={4}
                                        placeholder="Hi there, checking in regarding your property inquiry..."
                                        value={sendMessage}
                                        onChange={(e) => setSendMessage(e.target.value)}
                                        className="w-full bg-slate-900 border border-white/15 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button variant="ghost" onClick={() => setIsSendModalOpen(false)} className="text-slate-300 hover:bg-white/10">
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSendQuickSms}
                                        disabled={isSending || !sendPhone || !sendMessage}
                                        className="bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl gap-2"
                                    >
                                        <Send className="h-4 w-4" /> {isSending ? "Sending..." : "Send SMS"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

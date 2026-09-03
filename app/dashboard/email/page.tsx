"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Mail, Inbox, BarChart3 } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { subDays, format } from "date-fns";
import { useData } from "@/context/DataContext";
import { LMLoader } from "@/components/ryan-loader";
import { calculateEmailMetrics } from "@/lib/email-analytics-utils";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";

export default function EmailDashboardPage() {
    const router = useRouter();
    const [dateSubtitle, setDateSubtitle] = useState("all time");

    const { leads: allLeads, loadingLeads } = useData();
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 90),
        to: new Date(),
    });
    const loading = loadingLeads;

    const [metrics, setMetrics] = useState<any>({
        totalEmails: 0,
        replyCount: 0,
        replyRate: "0.0",
        dailyChartData: []
    });

    useEffect(() => {
        let isMounted = true;
        const fetchMetrics = async () => {
            try {
                const startDate = dateRange?.from ? new Date(dateRange.from).toISOString().split('T')[0] : '';
                const endDate = dateRange?.to ? new Date(dateRange.to).toISOString().split('T')[0] : '';
                const queryParams = new URLSearchParams();
                if (startDate) queryParams.append('start_date', startDate);
                if (endDate) queryParams.append('end_date', endDate);

                const res = await fetch(`/api/email/analytics?${queryParams.toString()}`);
                if (res.ok) {
                    const json = await res.json();
                    if (isMounted) {
                        const dailyChartData = (json.dailyHistory || []).map((item: any) => {
                            let dateStr = item.date;
                            try {
                                const d = new Date(item.date);
                                if (!isNaN(d.getTime())) dateStr = format(d, "MMM dd");
                            } catch (_) {}
                            return { ...item, date: dateStr };
                        });
                        setMetrics({
                            totalEmails: json.totalSent || 0,
                            replyCount: json.totalReplies || 0,
                            replyRate: json.totalSent > 0 ? ((json.totalReplies / json.totalSent) * 100).toFixed(1) : "0.0",
                            dailyChartData
                        });
                        return;
                    }
                }
            } catch (e) {
                console.error("[Email page metrics fetch error]", e);
            }

            if (!loadingLeads && isMounted) {
                const computed = calculateEmailMetrics(allLeads, dateRange);
                setMetrics(computed);
            }
        };

        fetchMetrics();
        return () => { isMounted = false; };
    }, [allLeads, loadingLeads, dateRange]);

    const handleDateUpdate = (range: any) => {
        setDateRange(range.range);
        if (range.label) {
            setDateSubtitle(range.label.toLowerCase() === "today" ? "sent today" : `sent ${range.label.toLowerCase()}`);
        } else {
            setDateSubtitle("sent in selected range");
        }
    };

    return (
        <div className="space-y-8 pb-10 relative min-h-[500px]">
            {loading && <LMLoader />}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Email Marketing Center</h1>
                    <p className="text-[var(--label-secondary)]">Monitor your campaign outreach and email activity trends</p>
                </div>
                <DateRangePicker onUpdate={handleDateUpdate} />
            </div>

            {/* Top Metrics Cards - Unsubscribed removed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MetricCard
                    title="Total Emails"
                    subtitle={dateSubtitle}
                    value={metrics.totalEmails}
                    icon={<Mail className="h-6 w-6 text-indigo-400" />}
                    bg="bg-indigo-500/10 border-indigo-500/20"
                    onClick={() => router.push('/dashboard/email/sent')}
                />

                <MetricCard
                    title="Total Replies"
                    subtitle="All time"
                    value={metrics.replyCount}
                    icon={<Inbox className="h-6 w-6 text-sky-400" />}
                    bg="bg-sky-500/10 border-sky-500/20"
                />
            </div>

            {/* Shifted Performance Graph from Analytics */}
            <Card className="bg-[var(--glass-fill)] border-[var(--separator)] p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--label-primary)] flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-blue-500" /> Daily Email Outreach & Reply Volume
                        </h3>
                        <p className="text-xs text-[var(--label-secondary)]">Trends over selected date range</p>
                    </div>
                </div>

                <div className="h-[350px] w-full">
                    {metrics.dailyChartData && metrics.dailyChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.dailyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--separator)" />
                                <XAxis dataKey="date" stroke="var(--label-tertiary)" fontSize={11} tickLine={false} />
                                <YAxis stroke="var(--label-tertiary)" fontSize={11} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-app)',
                                        borderColor: 'var(--separator)',
                                        borderRadius: '8px',
                                        color: 'var(--label-primary)'
                                    }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="sent" name="Emails Sent" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSent)" strokeWidth={2} />
                                <Area type="monotone" dataKey="replies" name="Replies Received" stroke="#10b981" fillOpacity={1} fill="url(#colorReplies)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-[var(--label-tertiary)] border border-dashed border-[var(--separator)] rounded-xl">
                            <Mail className="h-8 w-8 mb-2 opacity-50" />
                            <p className="text-sm">No activity recorded for this period</p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

function MetricCard({ title, subtitle, value, icon, bg, onClick }: any) {
    return (
        <Card
            className="border-[var(--separator)] hover:shadow-[var(--glass-shadow)] transition-all cursor-pointer bg-[var(--glass-fill)]"
            onClick={onClick}
        >
            <CardContent className="p-6 flex items-center justify-between">
                <div className="flex-1">
                    <div className="flex items-center">
                        <h3 className="text-2xl font-bold text-[var(--label-primary)]">{value}</h3>
                    </div>
                    <p className="text-sm font-bold text-[var(--label-primary)]">{title}</p>
                    <p className="text-xs text-[var(--label-secondary)]">{subtitle}</p>
                </div>
                <div className={`p-3 rounded-xl ${bg}`}>
                    {icon}
                </div>
            </CardContent>
        </Card>
    );
}

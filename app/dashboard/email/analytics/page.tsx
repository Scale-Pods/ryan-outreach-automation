"use client";

import { LMLoader } from "@/components/ryan-loader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    Send,
    TrendingUp,
    AlertTriangle,
    Users,
    Mail,
    Database,
    BarChart3
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
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
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { subDays, format } from "date-fns";
import { useData } from "@/context/DataContext";
import { calculateEmailMetrics } from "@/lib/email-analytics-utils";

export default function EmailAnalyticsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [apiAnalytics, setApiAnalytics] = useState<any>(null);
    const [loadingLocal, setLoadingLocal] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });

    const loading = loadingLocal || loadingLeads;

    const fetchData = async (start?: Date, end?: Date) => {
        setLoadingLocal(true);
        setError(null);
        try {
            const startDate = start ? start.toISOString().split('T')[0] : '';
            const endDate = end ? end.toISOString().split('T')[0] : '';

            const queryParams = new URLSearchParams();
            if (startDate) queryParams.append('start_date', startDate);
            if (endDate) queryParams.append('end_date', endDate);

            const res = await fetch(`/api/email/analytics?${queryParams.toString()}`);
            if (res.ok) {
                const json = await res.json();
                setApiAnalytics(json);
            }
        } catch (e: any) {
            console.error("Analytics fetch error", e);
            setError(e.message);
        } finally {
            setLoadingLocal(false);
        }
    };

    useEffect(() => {
        fetchData(dateRange?.from, dateRange?.to);
    }, [allLeads, loadingLeads]);

    const handleDateUpdate = ({ range }: { range: DateRange | undefined }) => {
        setDateRange(range);
        if (range?.from && range?.to) {
            fetchData(range.from, range.to);
        }
    };

    // Calculate comprehensive metrics across allLeads using unified helper
    const analytics = useMemo(() => {
        return calculateEmailMetrics(allLeads, dateRange);
    }, [allLeads, dateRange]);

    return (
        <div className="space-y-8 pb-10 relative min-h-[500px]">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--label-primary)]">Email Analytics</h1>
                    <p className="text-[var(--label-secondary)]">Activity metrics aggregated from all 4 database tables (Aspen, Fello, Naples, Old Leads)</p>
                </div>
                <div className="flex items-center gap-2">
                    <DateRangePicker onUpdate={handleDateUpdate} />
                    <Button
                        onClick={() => fetchData(dateRange?.from, dateRange?.to)}
                        variant="outline"
                        size="icon"
                        disabled={loading}
                    >
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* Overview Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-[var(--glass-fill)] border-[var(--separator)]">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20 shrink-0">
                            <Send className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-[var(--label-secondary)] font-medium">Total Emails Sent</p>
                            <h3 className="text-2xl font-bold text-[var(--label-primary)]">{analytics.totalEmails.toLocaleString()}</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[var(--glass-fill)] border-[var(--separator)]">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shrink-0">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-[var(--label-secondary)] font-medium">Total Replies</p>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-2xl font-bold text-[var(--label-primary)]">{analytics.totalReplies.toLocaleString()}</h3>
                                <span className="text-xs text-emerald-500 font-semibold">{analytics.replyRate}% rate</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[var(--glass-fill)] border-[var(--separator)]">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shrink-0">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-[var(--label-secondary)] font-medium">Unsubscribed</p>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-2xl font-bold text-[var(--label-primary)]">{analytics.totalUnsubscribed.toLocaleString()}</h3>
                                <span className="text-xs text-amber-500 font-semibold">{analytics.unsubRate}% rate</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-[var(--glass-fill)] border-[var(--separator)]">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20 shrink-0">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-[var(--label-secondary)] font-medium">Active Email Leads</p>
                            <h3 className="text-2xl font-bold text-[var(--label-primary)]">{analytics.totalLeadsCount.toLocaleString()}</h3>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Chart */}
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
                    {analytics.dailyChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analytics.dailyChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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

            {/* 4 Activity Tables Breakdown Grid */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-[var(--label-primary)] flex items-center gap-2">
                    <Database className="h-5 w-5 text-purple-500" /> Database Tables Breakdown
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(analytics.tableStats).map(([key, stat]) => (
                        <Card key={key} className="bg-[var(--glass-fill)] border-[var(--separator)]">
                            <CardContent className="p-5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-sm text-[var(--label-primary)]">{stat.name}</h4>
                                    <Badge variant="outline" className="text-xs uppercase bg-white/5 border-white/10">
                                        {key}
                                    </Badge>
                                </div>
                                <div className="space-y-2 pt-2 border-t border-[var(--separator)] text-xs">
                                    <div className="flex justify-between text-[var(--label-secondary)]">
                                        <span>Emails Sent:</span>
                                        <span className="font-semibold text-blue-400">{stat.emails}</span>
                                    </div>
                                    <div className="flex justify-between text-[var(--label-secondary)]">
                                        <span>Replies:</span>
                                        <span className="font-semibold text-emerald-400">{stat.replies}</span>
                                    </div>
                                    <div className="flex justify-between text-[var(--label-secondary)]">
                                        <span>Unsubscribed:</span>
                                        <span className="font-semibold text-amber-400">{stat.unsubscribed}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {loading && <LMLoader fullScreen={false} />}
        </div>
    );
}

function StatusBadge({ status, score }: { status: string, score: number }) {
    let colorClass = "bg-[var(--fill-quaternary)] text-[var(--label-primary)] hover:bg-[var(--fill-quaternary)]";
    if (status === "Healthy") colorClass = "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200";
    else if (status === "Medium") colorClass = "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200";
    else if (status === "Poor") colorClass = "bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200";

    return (
        <Badge variant="outline" className={cn("px-3 py-1 text-sm font-medium border", colorClass)}>
            {status} ({score}%)
        </Badge>
    );
}

function MiniMetric({ label, value, subtext, icon: Icon, color, bg }: any) {
    return (
        <div className="flex flex-col gap-1 p-3 rounded-xl bg-[var(--glass-fill)] border border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-[var(--label-tertiary)] font-semibold">{label}</span>
                <div className={cn("p-1.5 rounded-full", bg, color)}>
                    <Icon className="h-3 w-3" />
                </div>
            </div>
            <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-[var(--label-primary)]">{value}</span>
                {subtext && <span className="text-xs text-[var(--label-secondary)]">{subtext}</span>}
            </div>
        </div>
    );
}

function MetricCard({ label, value, subtext, icon: Icon, color, iconBg, iconColor }: any) {
    return (
        <Card className="bg-[var(--glass-fill)] border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)]">
            <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-[var(--label-tertiary)] uppercase tracking-wider">{label}</span>
                    <div className={cn("p-1.5 rounded-lg", iconBg, iconColor)}>
                        <Icon className="h-4 w-4" />
                    </div>
                </div>
                <div>
                    <h3 className="text-2xl font-bold text-[var(--label-primary)]">{value}</h3>
                    {subtext && <p className="text-xs font-medium text-[var(--label-secondary)] mt-1">{subtext}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

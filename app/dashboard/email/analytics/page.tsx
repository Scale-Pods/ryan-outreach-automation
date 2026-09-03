"use client";

import { LMLoader } from "@/components/ryan-loader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    RefreshCw,
    Send,
    TrendingUp,
    Users,
    Database,
    Layers
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { subDays } from "date-fns";
import { useData } from "@/context/DataContext";
import { calculateEmailMetrics } from "@/lib/email-analytics-utils";
import { EmailTrackerSection } from "@/components/dashboard/email-tracker";

export default function EmailAnalyticsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [apiAnalytics, setApiAnalytics] = useState<any>(null);
    const [loadingLocal, setLoadingLocal] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 90),
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

    // Calculate comprehensive metrics across activity tables & allLeads
    const analytics = useMemo(() => {
        if (apiAnalytics && typeof apiAnalytics.totalSent === 'number') {
            const tableStats = {
                naples: { name: "Naples (naples_activity)", totalLeads: apiAnalytics.tableStats?.naples_activity?.totalSent || 0, emails: apiAnalytics.tableStats?.naples_activity?.totalSent || 0, replies: apiAnalytics.tableStats?.naples_activity?.totalReplies || 0, unsubscribed: apiAnalytics.tableStats?.naples_activity?.totalUnsubscribed || 0 },
                aspen: { name: "Aspen (aspen_activity)", totalLeads: apiAnalytics.tableStats?.aspen_activity?.totalSent || 0, emails: apiAnalytics.tableStats?.aspen_activity?.totalSent || 0, replies: apiAnalytics.tableStats?.aspen_activity?.totalReplies || 0, unsubscribed: apiAnalytics.tableStats?.aspen_activity?.totalUnsubscribed || 0 },
                old: { name: "Old Leads (old_activity)", totalLeads: apiAnalytics.tableStats?.old_activity?.totalSent || 0, emails: apiAnalytics.tableStats?.old_activity?.totalSent || 0, replies: apiAnalytics.tableStats?.old_activity?.totalReplies || 0, unsubscribed: apiAnalytics.tableStats?.old_activity?.totalUnsubscribed || 0 },
                fello: { name: "Fello (fello_activity)", totalLeads: apiAnalytics.tableStats?.fello_activity?.totalSent || 0, emails: apiAnalytics.tableStats?.fello_activity?.totalSent || 0, replies: apiAnalytics.tableStats?.fello_activity?.totalReplies || 0, unsubscribed: apiAnalytics.tableStats?.fello_activity?.totalUnsubscribed || 0 },
            };
            const replyRate = apiAnalytics.totalSent > 0 ? ((apiAnalytics.totalReplies / apiAnalytics.totalSent) * 100).toFixed(1) : "0.0";
            return {
                totalEmails: apiAnalytics.totalSent,
                totalSent: apiAnalytics.totalSent,
                firstEmailCount: apiAnalytics.totalSent,
                replyCount: apiAnalytics.totalReplies,
                totalReplies: apiAnalytics.totalReplies,
                unsubscribedCount: apiAnalytics.totalUnsubscribed,
                totalUnsubscribed: apiAnalytics.totalUnsubscribed,
                totalLeadsCount: apiAnalytics.totalSent,
                totalLeads: apiAnalytics.totalSent,
                replyRate,
                unsubRate: "0.0",
                tableStats,
                dailyChartData: apiAnalytics.dailyHistory || []
            };
        }
        return calculateEmailMetrics(allLeads, dateRange);
    }, [allLeads, dateRange, apiAnalytics]);

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* Database Table Performance Cards */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--label-primary)] uppercase tracking-wider">Database Table Performance</h2>
                        <p className="text-xs text-[var(--label-secondary)]">Email reachout and engagement metrics across database streams</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <TablePerformanceCard
                        tableName="Naples"
                        tableKey="naples_activity"
                        stats={analytics.tableStats.naples}
                        badgeColor="bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        accentColor="#34c759"
                    />
                    <TablePerformanceCard
                        tableName="Aspen"
                        tableKey="aspen_activity"
                        stats={analytics.tableStats.aspen}
                        badgeColor="bg-amber-500/15 text-amber-400 border-amber-500/30"
                        accentColor="#f59e0b"
                    />
                    <TablePerformanceCard
                        tableName="Old Leads"
                        tableKey="old_activity"
                        stats={analytics.tableStats.old}
                        badgeColor="bg-purple-500/15 text-purple-400 border-purple-500/30"
                        accentColor="#8b5cf6"
                    />
                    <TablePerformanceCard
                        tableName="Fello"
                        tableKey="fello_activity"
                        stats={analytics.tableStats.fello}
                        badgeColor="bg-blue-500/15 text-blue-400 border-blue-500/30"
                        accentColor="#3b82f6"
                    />
                </div>
            </div>

            {/* Detailed Table Performance Summary */}
            <Card className="border-[var(--separator)] bg-[var(--glass-fill)]">
                <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Layers className="h-4 w-4 text-blue-400" />
                        <span>Database Stream Breakdown</span>
                    </CardTitle>
                    <CardDescription>Live summary of email campaign volume and response rates per database table</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow className="border-[var(--separator)]">
                                <TableHead>Database Table</TableHead>
                                <TableHead>Emails Sent</TableHead>
                                <TableHead>Replies Received</TableHead>
                                <TableHead>Reply Rate</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.entries(analytics.tableStats).map(([key, item]: [string, any]) => {
                                const rate = item.emails > 0 ? ((item.replies / item.emails) * 100).toFixed(1) : "0.0";
                                return (
                                    <TableRow key={key} className="border-[var(--separator)] hover:bg-[rgba(255,255,255,0.04)] transition-colors">
                                        <TableCell className="font-semibold text-[var(--label-primary)]">
                                            <div className="flex items-center gap-2">
                                                <Database className="h-4 w-4 text-[var(--label-tertiary)]" />
                                                <span>{item.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium text-[var(--label-primary)]">{item.emails}</TableCell>
                                        <TableCell className="font-medium text-emerald-400">{item.replies}</TableCell>
                                        <TableCell className="font-medium">{rate}%</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] uppercase font-bold px-2 py-0.5">
                                                Active Stream
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Email Account Tracker */}
            <div className="space-y-4">
                <div>
                    <h2 className="text-lg font-bold text-[var(--label-primary)] uppercase tracking-wider">Email Account Tracker</h2>
                    <p className="text-xs text-[var(--label-secondary)]">Monitor daily sending limits and usage per email account. Click the pencil icon to update the max allowed limit.</p>
                </div>
                <EmailTrackerSection />
            </div>

            {loading && <LMLoader fullScreen={false} />}
        </div>
    );
}

function TablePerformanceCard({ tableName, tableKey, stats, badgeColor, accentColor }: any) {
    const rate = stats.emails > 0 ? ((stats.replies / stats.emails) * 100).toFixed(1) : "0.0";

    return (
        <Card className="border-[var(--separator)] bg-[var(--glass-fill)] hover:shadow-[var(--glass-shadow)] transition-all">
            <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--label-primary)]">{tableName}</h3>
                        <p className="text-xs font-mono text-[var(--label-tertiary)]">{tableKey}</p>
                    </div>
                    <Badge className={`border text-[10px] uppercase font-bold px-2 py-0.5 ${badgeColor}`}>
                        {rate}% Reply
                    </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 py-2 border-y border-[var(--separator)] text-center">
                    <div>
                        <span className="text-xs text-[var(--label-tertiary)] block">Sent</span>
                        <span className="text-base font-bold text-[var(--label-primary)]">{stats.emails}</span>
                    </div>
                    <div>
                        <span className="text-xs text-[var(--label-tertiary)] block">Replies</span>
                        <span className="text-base font-bold text-emerald-400">{stats.replies}</span>
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-[var(--label-secondary)]">
                        <span>Engagement</span>
                        <span className="font-bold">{rate}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--fill-tertiary)] rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, parseFloat(rate) * 5)}%`, backgroundColor: accentColor }}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

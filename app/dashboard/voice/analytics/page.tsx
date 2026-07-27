"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Phone, CheckCircle, PhoneIncoming, RefreshCw, ArrowUpRight, Database, TrendingUp, Users } from "lucide-react";
import { LMLoader } from "@/components/ryan-loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
} from "recharts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useMemo } from "react";
import { format, subDays } from "date-fns";
import { useData } from "@/context/DataContext";
import { useRouter } from "next/navigation";

export default function VoiceAnalyticsPage() {
    const router = useRouter();
    const { voiceMetrics, loadingVoiceMetrics, refreshVoiceMetrics } = useData();

    const [accountFilter, setAccountFilter] = useState("all");
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const loading = loadingVoiceMetrics;
    const m = voiceMetrics;

    // Re-fetch whenever date or account filter changes
    useEffect(() => {
        if (!dateRange?.from) return;
        refreshVoiceMetrics({
            from: dateRange.from,
            to: dateRange.to || dateRange.from,
        });
    }, [dateRange, accountFilter, refreshVoiceMetrics]);

    // Volume trend — convert YYYY-MM-DD to display label
    const volumeData = (m?.dailyVolume ?? []).map(d => ({
        name: format(new Date(d.date + 'T00:00:00'), 'MMM dd'),
        value: d.calls,
    }));

    // Duration distribution
    const durationData = (m?.durationBuckets ?? []).map(b => ({
        name: b.label,
        value: b.calls,
    }));

    // Table statistics for naples, aspen, old, fello
    const tableStreams = useMemo(() => {
        const stats = m?.tableStats || {};
        return [
            { key: "naples", label: "Naples", tableName: "naples_activity", color: "emerald", badgeBg: "bg-emerald-100 text-emerald-700", data: stats.naples || { totalCalls: 0, pickupRate: 0, completionRate: 0, positiveRate: 0 } },
            { key: "aspen", label: "Aspen", tableName: "aspen_activity", color: "amber", badgeBg: "bg-amber-100 text-amber-700", data: stats.aspen || { totalCalls: 0, pickupRate: 0, completionRate: 0, positiveRate: 0 } },
            { key: "old", label: "Old Leads", tableName: "old_activity", color: "purple", badgeBg: "bg-purple-100 text-purple-700", data: stats.old || { totalCalls: 0, pickupRate: 0, completionRate: 0, positiveRate: 0 } },
            { key: "fello", label: "Fello", tableName: "fello_activity", color: "blue", badgeBg: "bg-blue-100 text-blue-700", data: stats.fello || { totalCalls: 0, pickupRate: 0, completionRate: 0, positiveRate: 0 } },
        ];
    }, [m]);

    const filteredStreams = useMemo(() => {
        if (accountFilter === "all") return tableStreams;
        return tableStreams.filter(s => s.key === accountFilter || s.tableName === accountFilter);
    }, [tableStreams, accountFilter]);

    return (
        <div className="space-y-8 pb-10 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--label-primary)]">Voice Analytics</h1>
                    <p className="text-[var(--label-secondary)]">Performance insights across Naples, Aspen, Old, and Fello voice tables.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Select value={accountFilter} onValueChange={setAccountFilter}>
                        <SelectTrigger className="w-[220px] h-10 border-[var(--separator)]">
                            <SelectValue placeholder="Database Table / Routing" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Database Tables</SelectItem>
                            <SelectItem value="naples">Naples (naples_activity)</SelectItem>
                            <SelectItem value="aspen">Aspen (aspen_activity)</SelectItem>
                            <SelectItem value="old">Old Leads (old_activity)</SelectItem>
                            <SelectItem value="fello">Fello (fello_activity)</SelectItem>
                        </SelectContent>
                    </Select>
                    <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refreshVoiceMetrics({ from: dateRange?.from, to: dateRange?.to, force: true })}
                        className="h-10"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Table Stream Analytics Overview (Naples, Aspen, Old, Fello) */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[var(--label-primary)] flex items-center gap-2">
                        <span className="p-1.5 bg-emerald-600 rounded-lg">
                            <PhoneIncoming className="h-4 w-4 text-white" />
                        </span>
                        Voice Routing Performance (Naples · Aspen · Old · Fello)
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/dashboard/voice/logs')}
                        className="text-xs text-emerald-600 font-bold hover:underline"
                    >
                        View All Voice Logs <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredStreams.map(stream => (
                        <Card key={stream.key} className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)] overflow-hidden">
                            <CardContent className="p-5 space-y-4">
                                <div className="flex items-center justify-between border-b border-[var(--separator)] pb-3">
                                    <div>
                                        <h3 className="font-bold text-base text-[var(--label-primary)]">{stream.label}</h3>
                                        <p className="font-mono text-[10px] text-[var(--label-tertiary)]">{stream.tableName}</p>
                                    </div>
                                    <Badge className={`${stream.badgeBg} border-none font-bold uppercase text-[10px]`}>
                                        {stream.label}
                                    </Badge>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div>
                                        <p className="text-[10px] font-bold text-[var(--label-secondary)] uppercase">Total Calls</p>
                                        <p className="text-xl font-bold text-[var(--label-primary)] mt-0.5">
                                            {loading ? "..." : (stream.data.totalCalls || 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-[var(--label-secondary)] uppercase">Pick-up Rate</p>
                                        <p className="text-xl font-bold text-indigo-600 mt-0.5">
                                            {loading ? "..." : `${(stream.data.pickupRate || 0).toFixed(1)}%`}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-[var(--label-secondary)] uppercase">Completion</p>
                                        <p className="text-xl font-bold text-emerald-600 mt-0.5">
                                            {loading ? "..." : `${(stream.data.completionRate || 0).toFixed(1)}%`}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-[var(--label-secondary)] uppercase">Positive Rate</p>
                                        <p className="text-xl font-bold text-blue-600 mt-0.5">
                                            {loading ? "..." : `${(stream.data.positiveRate || 0).toFixed(1)}%`}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Table & Routing Performance Section */}
            <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)] overflow-hidden">
                <CardHeader className="pb-3 border-b border-[var(--separator)] flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-sm font-bold text-[var(--label-primary)] flex items-center gap-2">
                            <Database className="h-4 w-4 text-emerald-600" /> Database Table & Call Routing Performance
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Detailed breakdown for naples_activity, aspen_activity, old_activity, and fello_activity
                        </CardDescription>
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push('/dashboard/voice/logs')}
                        className="text-xs gap-1.5 h-8"
                    >
                        <Phone className="h-3.5 w-3.5" /> Open Call Logs
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full text-sm">
                        <thead className="bg-[var(--bg-app)] text-[var(--label-secondary)] font-bold border-b border-[var(--separator)]">
                            <tr>
                                <th className="px-4 py-3 text-left">Routing / Source Table</th>
                                <th className="px-4 py-3 text-center">Total Calls</th>
                                <th className="px-4 py-3 text-center">Pick-up Rate (&gt;18s)</th>
                                <th className="px-4 py-3 text-center">Completion Rate</th>
                                <th className="px-4 py-3 text-center">Positive Rate</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--separator)]">
                            {tableStreams.map(stream => (
                                <tr key={stream.key} className="hover:bg-[var(--bg-app)] transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Badge className={`${stream.badgeBg} border-none font-bold uppercase text-[10px]`}>
                                                {stream.label}
                                            </Badge>
                                            <span className="font-mono text-xs text-[var(--label-secondary)]">({stream.tableName})</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-[var(--label-primary)] font-bold">
                                        {(stream.data.totalCalls || 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-center text-indigo-600 font-bold">
                                        {(stream.data.pickupRate || 0).toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-3 text-center text-emerald-600 font-bold">
                                        {(stream.data.completionRate || 0).toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-3 text-center text-blue-600 font-bold">
                                        {(stream.data.positiveRate || 0).toFixed(1)}%
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => router.push(`/dashboard/voice/logs?account=${stream.key}`)}
                                            className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7"
                                        >
                                            View Logs <ArrowUpRight className="h-3 w-3 ml-1" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)]">
                    <CardHeader>
                        <CardTitle className="text-lg">Call Volume Trends</CardTitle>
                        <CardDescription className="text-xs">Daily voice call activity over selected date range</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="w-full h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={volumeData.length ? volumeData : [{ name: 'No data', value: 0 }]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={5} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
                                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)]">
                    <CardHeader>
                        <CardTitle className="text-lg">Duration Distribution</CardTitle>
                        <CardDescription className="text-xs">Breakdown of calls by duration buckets</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="w-full h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={durationData.length ? durationData : [{ name: 'No data', value: 0 }]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={5} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
                                    <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

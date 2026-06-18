"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, CheckCircle, PhoneIncoming, Crown } from "lucide-react";
import { LMLoader } from "@/components/lm-loader";
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
import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { useData } from "@/context/DataContext";

export default function VoiceAnalyticsPage() {
    const { voiceMetrics, loadingVoiceMetrics, allTimeVoiceCount, allTimeOwnerVoiceCount, refreshVoiceMetrics } = useData();

    const [accountFilter, setAccountFilter] = useState("vapi");
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    const loading = loadingVoiceMetrics;
    const m = voiceMetrics;

    // Which sections to show based on the dropdown
    const showNormal = accountFilter === 'vapi' || accountFilter === 'vapi-normal';
    const showOwners = accountFilter === 'vapi' || accountFilter === 'vapi-owners';

    // Re-fetch whenever date or account filter changes
    useEffect(() => {
        if (!dateRange?.from) return;
        refreshVoiceMetrics({
            from: dateRange.from,
            to: dateRange.to || dateRange.from,
            includeElevenLabs: accountFilter === 'elevenlabs',
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

    return (
        <div className="space-y-8 pb-10 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Voice Analytics</h1>
                    <p className="text-slate-500">Comprehensive insights across all voice accounts.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Select value={accountFilter} onValueChange={setAccountFilter}>
                        <SelectTrigger className="w-[190px] h-10">
                            <SelectValue placeholder="Account / Provider" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="vapi">All Vapi Calls</SelectItem>
                            <SelectItem value="vapi-owners">Owner Leads</SelectItem>
                            <SelectItem value="vapi-normal">Normal Calls</SelectItem>
                            <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                        </SelectContent>
                    </Select>
                    <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                </div>
            </div>

            {/* All-Time Totals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard
                    title="Total Normal Calls"
                    value={(m?.allTimeNormalCalls ?? allTimeVoiceCount).toLocaleString()}
                    change="All Time"
                    icon={<Phone className="h-5 w-5" />}
                    color="text-blue-600"
                    bg="bg-blue-50"
                />
                <StatCard
                    title="Total Owner Calls"
                    value={(m?.allTimeOwnerCalls ?? allTimeOwnerVoiceCount).toLocaleString()}
                    change="All Time"
                    icon={<Crown className="h-5 w-5" />}
                    color="text-amber-600"
                    bg="bg-amber-50"
                />
            </div>

            {/* Normal Calls Funnel */}
            {showNormal && (
                <div>
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <span className="p-1.5 bg-blue-600 rounded-lg">
                            <PhoneIncoming className="h-4 w-4 text-white" />
                        </span>
                        Normal Calls Analytics
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Calls in Range"
                            value={(m?.normalCalls ?? 0).toLocaleString()}
                            change="Selected Dates"
                            icon={<Phone className="h-5 w-5" />}
                            color="text-blue-600"
                            bg="bg-blue-50"
                        />
                        <StatCard
                            title="Call Pick-up Rate"
                            value={`${(m?.normalPickupRate ?? 0).toFixed(1)}%`}
                            change="Picked & duration > 18 sec"
                            icon={<Phone className="h-5 w-5" />}
                            color="text-indigo-600"
                            bg="bg-indigo-50"
                        />
                        <StatCard
                            title="Call Completion Rate"
                            value={`${(m?.normalCompletionRate ?? 0).toFixed(1)}%`}
                            change="Completed Conversation"
                            icon={<CheckCircle className="h-5 w-5" />}
                            color="text-emerald-600"
                            bg="bg-emerald-50"
                        />
                        <StatCard
                            title="Positive Response Rate"
                            value={`${(m?.normalPositiveRate ?? 0).toFixed(1)}%`}
                            change="Positive & Hesitant"
                            icon={<CheckCircle className="h-5 w-5" />}
                            color="text-blue-600"
                            bg="bg-blue-50"
                        />
                    </div>
                </div>
            )}

            {/* Owner Calls Funnel */}
            {showOwners && (
                <div>
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <span className="p-1.5 bg-amber-600 rounded-lg">
                            <Crown className="h-4 w-4 text-white" />
                        </span>
                        Owner Data Analytics
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Calls in Range"
                            value={(m?.ownerCalls ?? 0).toLocaleString()}
                            change="Selected Dates"
                            icon={<Crown className="h-5 w-5" />}
                            color="text-amber-600"
                            bg="bg-amber-50"
                        />
                        <StatCard
                            title="Call Pick-up Rate"
                            value={`${(m?.ownerPickupRate ?? 0).toFixed(1)}%`}
                            change="Picked & duration > 18 sec"
                            icon={<Phone className="h-5 w-5" />}
                            color="text-amber-600"
                            bg="bg-amber-50"
                        />
                        <StatCard
                            title="Call Completion Rate"
                            value={`${(m?.ownerCompletionRate ?? 0).toFixed(1)}%`}
                            change="Completed Conversation"
                            icon={<CheckCircle className="h-5 w-5" />}
                            color="text-emerald-600"
                            bg="bg-emerald-50"
                        />
                        <StatCard
                            title="Positive Response Rate"
                            value={`${(m?.ownerPositiveRate ?? 0).toFixed(1)}%`}
                            change="EOI & Callback"
                            icon={<CheckCircle className="h-5 w-5" />}
                            color="text-blue-600"
                            bg="bg-blue-50"
                        />
                    </div>
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Call Volume Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="w-full h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={volumeData.length ? volumeData : [{ name: 'No data', value: 0 }]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Duration Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="w-full h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={durationData.length ? durationData : [{ name: 'No data', value: 0 }]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} />
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

function StatCard({ title, value, change, icon, color, bg, isNegative }: any) {
    return (
        <Card className="border-slate-200">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-tighter">{title}</p>
                        <h3 className="text-2xl font-bold text-slate-950 mt-1">{value}</h3>
                        <span className={`text-xs font-bold ${isNegative ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {change} {isNegative ? '↓' : '↑'}
                        </span>
                    </div>
                    {icon && <div className={`p-4 rounded-2xl ${bg} ${color}`}>{icon}</div>}
                </div>
            </CardContent>
        </Card>
    );
}

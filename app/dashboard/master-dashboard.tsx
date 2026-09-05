"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Users,
    MessageCircle,
    TrendingUp,
    PieChart as PieChartIcon,
    Activity,
    Maximize2,
    Minimize2,
    X,
    Expand,
    Info,
    Smartphone
} from "lucide-react";
import {
    Tooltip as UITooltip,
    TooltipContent as UITooltipContent,
    TooltipProvider as UITooltipProvider,
    TooltipTrigger as UITooltipTrigger,
} from "@/components/ui/tooltip";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { TotalRepliesView } from "@/components/dashboard/total-replies-view";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { LMLoader } from "@/components/ryan-loader";
import { useData } from "@/context/DataContext";

import { extractReplyDate } from "@/lib/reply-utils";

export default function MasterDashboard() {
    const [isRepliesModalOpen, setIsRepliesModalOpen] = useState(false);
    const [isRepliesExpanded, setIsRepliesExpanded] = useState(false);
    const [chatLead, setChatLead] = useState<any | null>(null);
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date()
    });

    const {
        masterMetrics,
        loadingMasterMetrics,
        refreshMasterMetrics,
        leads = [],
    } = useData();

    // Re-fetch server metrics when date changes
    useEffect(() => {
        if (!dateRange?.from) return;
        refreshMasterMetrics({
            from: dateRange.from,
            to: dateRange.to || dateRange.from,
        });
    }, [dateRange, refreshMasterMetrics]);

    // Fetch WA leads — used for accurate unique reachout count AND the replies modal
    const [waUniqueSent, setWaUniqueSent] = useState<number | null>(null);
    const [waReplies, setWaReplies] = useState<number | null>(null);
    const [waReplyLeads, setWaReplyLeads] = useState<any[]>([]);

    const fetchWaStats = useCallback(async (from: Date, to: Date) => {
        const fromISO = startOfDay(from).toISOString();
        const toISO = endOfDay(to).toISOString();
        const res = await fetch(`/api/whatsapp-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
        if (!res.ok) return;
        const data = await res.json();
        const allLeadsWA: any[] = [
            ...(data.nr_wf || []),
            ...(data.followup || []),
            ...(data.nurture || []),
        ];
        const rangeFrom = startOfDay(from).getTime();
        const rangeTo = endOfDay(to).getTime();
        let unique = 0;
        const replied: any[] = [];

        allLeadsWA.forEach((lead: any) => {
            if (lead["W.P_1"]) {
                const t = lead.wp1_parsed_date ? new Date(lead.wp1_parsed_date).getTime() : null;
                const inRange = !t || (t >= rangeFrom && t <= rangeTo);
                if (inRange) unique++;
            }

            const wp = lead.WP_Replied_track || lead["WP_Replied_track"] || lead.whatsapp_replied || lead["W.P_Replied 1"];
            const isReplied = wp && String(wp).toLowerCase() !== 'no' && String(wp).toLowerCase() !== 'none' && String(wp).trim() !== '' && String(wp).trim() !== '0';
            if (isReplied) {
                const rDate = extractReplyDate(lead);
                if (rDate) {
                    const rt = rDate.getTime();
                    if (rt >= rangeFrom && rt <= rangeTo) {
                        replied.push(lead);
                    }
                }
            }
        });

        setWaUniqueSent(unique);
        setWaReplies(replied.length);
        setWaReplyLeads(replied);
    }, []);

    useEffect(() => {
        if (!dateRange?.from) return;
        fetchWaStats(dateRange.from, dateRange.to || dateRange.from);
    }, [dateRange, fetchWaStats]);

    const combinedReplyLeads = useMemo(() => {
        const fromTime = dateRange?.from ? startOfDay(new Date(dateRange.from)).getTime() : null;
        const toTime = dateRange?.to ? endOfDay(new Date(dateRange.to)).getTime() : fromTime;

        const replyList: any[] = [];
        const seenIds = new Set<string>();

        const checkReplyDate = (lead: any) => {
            if (!fromTime) return true;
            const rDate = extractReplyDate(lead);
            if (!rDate) return false;
            const t = rDate.getTime();
            return t >= fromTime && (!toTime || t <= toTime);
        };

        // 1. Process waReplyLeads
        (waReplyLeads || []).forEach((l: any) => {
            if (checkReplyDate(l)) {
                const uid = l.id || l["Lead ID"] || l.lead_id;
                if (uid && !seenIds.has(String(uid))) {
                    seenIds.add(String(uid));
                    replyList.push(l);
                }
            }
        });

        // 2. Process leads context (includes aspen_activity, fello_activity, naples_activity, old_activity)
        (leads || []).forEach((l: any) => {
            const channel = String(l.channel || '').toLowerCase();
            const actionType = String(l.action_type || '').toLowerCase();
            const status = String(l.status || '').toLowerCase();
            const rVal = String(l.replied ?? '').toLowerCase().trim();

            const wtR = l.WP_Replied_track || l["WP_Replied_track"] || l.whatsapp_replied || l["W.P_Replied 1"];
            const emR = l.email_replied || l["Email Replied"];
            const isActivityReply =
                (l._source_table?.endsWith('_activity') || l.channel || l.action_type) &&
                (rVal === 'yes' ||
                rVal === 'true' ||
                rVal === '1' ||
                status.includes('reply') ||
                status.includes('replied') ||
                actionType.includes('reply') ||
                actionType.includes('inbound') ||
                !!l.replied_at);

            const hasWpReply = wtR && !["no", "none", "", "0"].includes(String(wtR).toLowerCase().trim());
            const hasEmailReply = emR && !["no", "none", "", "0"].includes(String(emR).toLowerCase().trim());

            if (hasWpReply || hasEmailReply || isActivityReply) {
                if (checkReplyDate(l)) {
                    const uid = l._source_table ? `${l._source_table}-${l.id}` : (l.id || l["Lead ID"]);
                    if (uid && !seenIds.has(String(uid))) {
                        seenIds.add(String(uid));
                        replyList.push(l);
                    }
                }
            }
        });

        return replyList;
    }, [waReplyLeads, leads, dateRange]);

    const loading = loadingMasterMetrics;

    const acquisitionChartData = useMemo(() => {
        const daily = masterMetrics?.dailyAcquisition || masterMetrics?.leadsDaily || [];
        if (!daily.length) return [];
        return daily.map((d: any) => {
            const dateObj = new Date(d.date + 'T00:00:00');
            return {
                name: !isNaN(dateObj.getTime()) ? format(dateObj, 'MMM dd') : d.date,
                leads: d.leads ?? d.count ?? 0,
            };
        });
    }, [masterMetrics]);

    const m = masterMetrics;
    const totalWaReplies = waReplies ?? m?.totalWaReplies ?? 0;
    const totalWaReachouts = waUniqueSent ?? m?.totalWaReachouts ?? 0;
    const emailCount = m?.activityEmailCount ?? 0;
    const smsCount = m?.activitySmsCount ?? 0;
    const displayTotalLeads = Math.max(m?.totalLeads ?? 0, (leads || []).length);
    const displayEmailsSent = emailCount;
    const displayWaReachouts = Math.max(totalWaReachouts, m?.activityWaCount ?? 0);
    const displayVoiceCalls = Math.max(m?.totalVoiceCalls ?? 0, m?.activityVoiceCount ?? 0);
    const displayReplies = combinedReplyLeads.length;
    const displayReplyRate = displayWaReachouts > 0 ? ((displayReplies / displayWaReachouts) * 100).toFixed(1) : '0';

    const realServiceDistribution = useMemo(() => {
        return [
            { name: 'Email', value: displayEmailsSent, color: '#3b82f6' },
            { name: 'WhatsApp', value: displayWaReachouts, color: '#10b981' },
            { name: 'Voice', value: displayVoiceCalls, color: '#8b5cf6' },
            { name: 'SMS', value: smsCount, color: '#f59e0b' },
        ];
    }, [displayEmailsSent, displayWaReachouts, displayVoiceCalls, smsCount]);

    const activeServiceDistribution = useMemo(() => 
        realServiceDistribution.filter(d => d.value > 0),
    [realServiceDistribution]);

    const totalOutreach = useMemo(() => 
        realServiceDistribution.reduce((acc, curr) => acc + curr.value, 0),
    [realServiceDistribution]);

    const router = useRouter();

    return (
        <div className="space-y-8 pb-10 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--label-primary)]">Master Overview</h1>
                    <p className="text-[var(--label-secondary)]">Holistic view of all your marketing channels performance.</p>
                </div>
                <DateRangePicker onUpdate={({ range }) => setDateRange(range)} />
            </div>

            {/* Top Metric Cards Grid */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
                <MetricCard
                    title="Total Leads"
                    value={loading ? "..." : displayTotalLeads.toLocaleString()}
                    change={m?.oldestLeadDate ? `Since ${format(new Date(m.oldestLeadDate), 'MMM d')}` : "Real-time"}
                    isUp={true}
                    icon={<Users className="h-6 w-6" />}
                    color="text-blue-400"
                    bg="bg-blue-500/10"
                    border="border-blue-500/20"
                />
                <MetricCard
                    title="Total Emails Sent"
                    value={loading ? "..." : displayEmailsSent.toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<TrendingUp className="h-6 w-6" />}
                    color="text-emerald-400"
                    bg="bg-emerald-500/10"
                    border="border-emerald-500/20"
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricCard
                    title="Total Whatsapp Reachouts"
                    value={loading ? "..." : displayWaReachouts.toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<MessageCircle className="h-6 w-6" />}
                    color="text-purple-400"
                    bg="bg-purple-500/10"
                    border="border-purple-500/20"
                    onClick={() => router.push('/dashboard/whatsapp/chat')}
                />
                <MetricCard
                    title="Total Voice Calls"
                    value={loading ? "..." : displayVoiceCalls.toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<Activity className="h-6 w-6" />}
                    color="text-orange-400"
                    bg="bg-orange-500/10"
                    border="border-orange-500/20"
                    onClick={() => router.push('/dashboard/voice')}
                    info="This shows Normal calls containing US, UK, UAE, 1731 leads, openhouse leads."
                />
                <MetricCard
                    title="Total SMS Reachouts"
                    value={loading ? "..." : smsCount.toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<Smartphone className="h-6 w-6" />}
                    color="text-blue-400"
                    bg="bg-blue-500/10"
                    border="border-blue-500/20"
                    onClick={() => router.push('/dashboard/sms')}
                />
                <MetricCard
                    title="Total Replies"
                    value={loading ? "..." : displayReplies.toLocaleString()}
                    change={`${displayReplyRate}% Rate`}
                    isUp={true}
                    icon={<Expand className="h-6 w-6" />}
                    color="text-indigo-400"
                    bg="bg-indigo-500/10"
                    border="border-indigo-500/20"
                    onClick={() => setIsRepliesModalOpen(true)}
                    info="This rate is calculated as (Total Replies / Total WhatsApp Reachouts). Disclaimer: This feature has been installed now. To check original replies and rates, please select the 'Last 3 Months' filter."
                    action={<Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg p-0 border border-white/10 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsRepliesExpanded(!isRepliesExpanded);
                        }}
                    >
                        {isRepliesExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </Button>}
                />
            </div>

            {/* Expanded Replies View */}
            {isRepliesExpanded && (
                <div className="bg-[#0d121f] border border-white/10 rounded-xl p-6 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-white">Total Replies Details</h2>
                            <p className="text-sm text-slate-400">Detailed view of all replies across channels</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setIsRepliesExpanded(false)} className="text-slate-300 hover:bg-white/10">
                            <X className="h-4 w-4 mr-2" />
                            Close
                        </Button>
                    </div>
                    <TotalRepliesView leads={combinedReplyLeads} dateRange={dateRange} onViewLead={(lead) => { setIsRepliesExpanded(false); setChatLead(lead); }} />
                </div>
            )}

            {/* Replies Modal */}
            <Dialog open={isRepliesModalOpen} onOpenChange={setIsRepliesModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0d121f] text-white border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white">Total Replies - Detailed View</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <TotalRepliesView leads={combinedReplyLeads} dateRange={dateRange} onViewLead={(lead) => { setIsRepliesModalOpen(false); setChatLead(lead); }} />
                    </div>
                </DialogContent>
            </Dialog>

            {/* WhatsApp Chat Detail — opened from Total Replies view */}
            <Dialog open={!!chatLead} onOpenChange={(open) => { if (!open) setChatLead(null); }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0 bg-[#0d121f] text-white border-white/10">
                    <DialogHeader className="sr-only"><DialogTitle>WhatsApp Chat Detail</DialogTitle></DialogHeader>
                    {chatLead && (
                        <WhatsAppChatDetail
                            customerId={String(chatLead["Lead ID"] || chatLead.id || "")}
                            initialLead={chatLead}
                            onClose={() => setChatLead(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Channel Reachout Activity Over Time */}
                <Card className="lg:col-span-2 border-white/10 shadow-xl bg-[#0d121f] text-white">
                    <CardHeader>
                        <CardTitle className="text-base font-bold text-white">Daily Outreach Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            {acquisitionChartData.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                    No outreach data available for the selected period
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={acquisitionChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#007AFF" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#007AFF" stopOpacity={0.0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="name" stroke="#8E8E93" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#8E8E93" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                borderRadius: '12px',
                                                border: '1px solid rgba(0,0,0,0.1)',
                                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                                            }}
                                        />
                                        <Area type="monotone" dataKey="leads" stroke="#007AFF" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLeads)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Channel Distribution Donut */}
                <Card className="border-white/10 shadow-xl bg-[#0d121f] text-white">
                    <CardHeader>
                        <CardTitle className="text-base font-bold text-white">Channel Volume Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full flex items-center justify-center">
                            {totalOutreach === 0 ? (
                                <div className="text-slate-400 text-sm">No channel distribution data</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={activeServiceDistribution}
                                            cx="50%"
                                            cy="45%"
                                            innerRadius={60}
                                            outerRadius={85}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {activeServiceDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: any, name: any) => [
                                                `${Number(value).toLocaleString()} (${((Number(value) / totalOutreach) * 100).toFixed(1)}%)`,
                                                name
                                            ]}
                                            contentStyle={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                borderRadius: '12px',
                                                border: '1px solid rgba(0,0,0,0.1)',
                                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
                                            }}
                                        />
                                        <Legend
                                            verticalAlign="bottom"
                                            height={36}
                                            formatter={(value: any) => {
                                                const item = realServiceDistribution.find(d => d.name === value);
                                                const val = item ? item.value : 0;
                                                const pct = totalOutreach > 0 ? ((val / totalOutreach) * 100).toFixed(0) : '0';
                                                return <span className="text-xs font-medium text-slate-300">{value} ({val.toLocaleString()} - {pct}%)</span>;
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function MetricCard({ title, value, change, isUp, icon, color, bg, border, onClick, action, info }: {
    title: string;
    value: string;
    change: string;
    isUp: boolean;
    icon: React.ReactNode;
    color: string;
    bg: string;
    border: string;
    onClick?: () => void;
    action?: React.ReactNode;
    info?: string;
}) {
    return (
        <Card
            className={`bg-[#0d121f]/90 backdrop-blur-2xl border border-white/10 shadow-xl overflow-hidden relative group hover:border-white/20 hover:bg-[#121829] transition-all duration-300 flex flex-col justify-between h-full min-h-[145px] ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <CardContent className="p-4 flex flex-col justify-between h-full">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight" title={title}>
                                {title}
                            </p>
                            {info && (
                                <UITooltipProvider>
                                    <UITooltip>
                                        <UITooltipTrigger asChild>
                                            <Info className="h-3 w-3 text-slate-400 cursor-help hover:text-white transition-colors shrink-0" />
                                        </UITooltipTrigger>
                                        <UITooltipContent className="max-w-[250px] bg-slate-900/90 backdrop-blur-xl text-white border border-white/10 p-3 shadow-2xl rounded-xl z-50">
                                            <p className="text-[11px] leading-relaxed">{info}</p>
                                        </UITooltipContent>
                                    </UITooltip>
                                </UITooltipProvider>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {action}
                        <div className={`w-9 h-9 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0 border border-white/5`}>
                            {React.cloneElement(icon as React.ReactElement, { className: "h-4 w-4" })}
                        </div>
                    </div>
                </div>

                {/* Big Metric Number */}
                <div className="my-2">
                    <h3 className="text-2xl font-extrabold text-white tracking-tight leading-none">{value}</h3>
                </div>

                {/* Bottom Status Tag */}
                <div className="flex items-center">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)] shrink-0" />
                        {change}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

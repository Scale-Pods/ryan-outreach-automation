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
    Info
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
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { subDays, startOfDay, endOfDay, format } from "date-fns";
import { LMLoader } from "@/components/ryan-loader";
import { useData } from "@/context/DataContext";

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
            const hasReply = wp && String(wp).trim() && String(wp).trim().toLowerCase() !== "no" && String(wp).trim().toLowerCase() !== "none";
            if (hasReply) {
                replied.push({
                    ...lead,
                    id: lead["Lead ID"] || lead.id,
                    name: lead["Name"] || lead.name || "Unknown",
                    phone: lead["Phone"] || lead.phone || "",
                    email: lead["Email"] || lead.email || "",
                    WP_Replied_track: wp,
                });
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
        const map = new Map<string, any>();
        (waReplyLeads || []).forEach(lead => {
            const id = String(lead["Lead ID"] || lead.id || lead["Phone"] || lead.phone || lead["Email"] || lead.email || Math.random());
            map.set(id, lead);
        });
        (leads || []).forEach(lead => {
            const wp = lead.WP_Replied_track || lead["WP_Replied_track"] || lead.whatsapp_replied || lead.email_replied || lead["W.P_Replied 1"] || lead["W.P_Replied_1"];
            const hasReply = (wp && String(wp).trim() && String(wp).trim().toLowerCase() !== "no" && String(wp).trim().toLowerCase() !== "none") ||
                lead.action_type === 'reply' || lead.status === 'replied' || lead.replied_at ||
                String(lead.replied).toLowerCase() === "yes" || String(lead.replied).toLowerCase() === "true";
            if (hasReply) {
                const id = String(lead["Lead ID"] || lead.id || lead["Phone"] || lead.phone || lead["Email"] || lead.email || Math.random());
                if (!map.has(id)) {
                    map.set(id, lead);
                }
            }
        });
        return Array.from(map.values());
    }, [leads, waReplyLeads]);

    const loading = loadingMasterMetrics;

    // Acquisition chart from server-computed daily buckets
    const acquisitionChartData = useMemo(() => {
        if (!masterMetrics?.leadsDaily?.length) return [];
        return masterMetrics.leadsDaily.map(d => ({
            name: format(new Date(d.date + 'T00:00:00'), 'MMM dd'),
            leads: d.leads,
        }));
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
    const displayReplies = Math.max(totalWaReplies, m?.activityRepliesCount ?? 0);
    const displayReplyRate = displayWaReachouts > 0 ? ((displayReplies / displayWaReachouts) * 100).toFixed(1) : '0';

    const realServiceDistribution = useMemo(() => {
        const list = [
            { name: 'Email', value: displayEmailsSent, color: '#3b82f6' },
            { name: 'WhatsApp', value: displayWaReachouts, color: '#10b981' },
            { name: 'Voice', value: displayVoiceCalls, color: '#8b5cf6' },
        ];
        if (smsCount > 0) {
            list.push({ name: 'SMS', value: smsCount, color: '#f59e0b' });
        }
        return list;
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

            {/* Top Metric Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <MetricCard
                    title="Total Leads"
                    value={loading ? "..." : displayTotalLeads.toLocaleString()}
                    change={m?.oldestLeadDate ? `Since ${format(new Date(m.oldestLeadDate), 'MMM d')}` : "Real-time"}
                    isUp={true}
                    icon={<Users className="h-6 w-6" />}
                    color="text-blue-600"
                    bg="bg-[rgba(0,122,255,0.08)]"
                    border="border-blue-100"
                />
                <MetricCard
                    title="Total Emails Sent"
                    value={loading ? "..." : displayEmailsSent.toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<TrendingUp className="h-6 w-6" />}
                    color="text-emerald-600"
                    bg="bg-[rgba(52,199,89,0.08)]"
                    border="border-emerald-100"
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricCard
                    title="Total Whatsapp Reachouts"
                    value={loading ? "..." : displayWaReachouts.toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<MessageCircle className="h-6 w-6" />}
                    color="text-purple-600"
                    bg="bg-[rgba(175,82,222,0.08)]"
                    border="border-purple-100"
                    onClick={() => router.push('/dashboard/whatsapp/chat')}
                />
                <MetricCard
                    title="Total Voice Calls"
                    value={loading ? "..." : displayVoiceCalls.toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<Activity className="h-6 w-6" />}
                    color="text-orange-600"
                    bg="bg-[rgba(255,149,0,0.08)]"
                    border="border-orange-100"
                    onClick={() => router.push('/dashboard/voice')}
                    info="This shows Normal calls containing US, UK, UAE, 1731 leads, openhouse leads."
                />
                <MetricCard
                    title="Total Replies"
                    value={loading ? "..." : displayReplies.toLocaleString()}
                    change={`${displayReplyRate}% Rate`}
                    isUp={true}
                    icon={<Expand className="h-6 w-6" />}
                    color="text-indigo-600"
                    bg="bg-indigo-50"
                    border="border-indigo-100"
                    onClick={() => setIsRepliesModalOpen(true)}
                    info="This rate is calculated as (Total Replies / Total WhatsApp Reachouts). Disclaimer: This feature has been installed now. To check original replies and rates, please select the 'Last 3 Months' filter."
                    action={<Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[var(--label-tertiary)] hover:text-[var(--label-primary)]"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsRepliesExpanded(!isRepliesExpanded);
                        }}
                    >
                        {isRepliesExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>}
                />
            </div>


            {/* Expanded Replies View */}
            {isRepliesExpanded && (
                <div className="bg-[var(--glass-fill)] border border-[var(--separator)] rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-[var(--label-primary)]">Total Replies Details</h2>
                            <p className="text-sm text-[var(--label-secondary)]">Detailed view of all replies across channels</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setIsRepliesExpanded(false)}>
                            <X className="h-4 w-4 mr-2" />
                            Close
                        </Button>
                    </div>
                    <TotalRepliesView leads={combinedReplyLeads} dateRange={dateRange} onViewLead={(lead) => { setIsRepliesExpanded(false); setChatLead(lead); }} />
                </div>
            )}

            {/* Replies Modal */}
            <Dialog open={isRepliesModalOpen} onOpenChange={setIsRepliesModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Total Replies - Detailed View</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <TotalRepliesView leads={combinedReplyLeads} dateRange={dateRange} onViewLead={(lead) => { setIsRepliesModalOpen(false); setChatLead(lead); }} />
                    </div>
                </DialogContent>
            </Dialog>

            {/* WhatsApp Chat Detail — opened from Total Replies view */}
            <Dialog open={!!chatLead} onOpenChange={(open) => { if (!open) setChatLead(null); }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0">
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

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2 border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)] overflow-hidden">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-[rgba(0,122,255,0.08)] text-blue-600 rounded-lg">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <CardTitle className="text-lg">Lead Acquisition</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="w-full" style={{ height: 350, minHeight: 350 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={acquisitionChartData}>
                                    <defs>
                                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                    <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                    <Area type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)] overflow-hidden">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-[rgba(175,82,222,0.08)] text-purple-600 rounded-lg">
                                <PieChartIcon className="h-5 w-5" />
                            </div>
                            <CardTitle className="text-lg">Response Performance</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 flex flex-col items-center justify-center">
                        <div className="w-full h-[300px] min-h-[300px] flex items-center justify-center">
                            {totalOutreach === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center p-4">
                                    <PieChartIcon className="h-12 w-12 text-[var(--label-tertiary)] opacity-30 mb-2" />
                                    <p className="text-sm font-medium text-[var(--label-secondary)]">No Outreach Data</p>
                                    <p className="text-xs text-[var(--label-tertiary)]">No activity recorded for selected date range</p>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={activeServiceDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={activeServiceDistribution.length > 1 ? 5 : 0}
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
                                                return <span className="text-xs font-medium text-[var(--label-secondary)]">{value} ({val.toLocaleString()} - {pct}%)</span>;
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
            className={`bg-white/[0.04] backdrop-blur-[20px] saturate-[180%] border border-white/10 border-t-white/20 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] overflow-hidden relative group hover:bg-white/[0.08] hover:border-white/20 hover:shadow-[0_16px_40px_-10px_rgba(59,130,246,0.25)] hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <CardContent className="p-6">
                <div className="flex items-start justify-between relative z-10">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mr-2">
                            <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
                                {info && (
                                    <UITooltipProvider>
                                        <UITooltip>
                                            <UITooltipTrigger asChild>
                                                <Info className="h-4 w-4 text-slate-400 mb-1 cursor-help hover:text-white transition-colors" />
                                            </UITooltipTrigger>
                                            <UITooltipContent className="max-w-[250px] bg-slate-900/90 backdrop-blur-xl text-white border border-white/10 p-3 shadow-2xl rounded-xl">
                                                <p className="text-[11px] leading-relaxed">{info}</p>
                                            </UITooltipContent>
                                        </UITooltip>
                                    </UITooltipProvider>
                                )}
                            </div>
                            {action && <div className="z-20">{action}</div>}
                        </div>
                        <h3 className="text-3xl font-bold text-white my-1">{value}</h3>
                        <div className="mt-2 flex items-center gap-1.5">
                            <span className="glass-pill-tag text-emerald-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                {change}
                            </span>
                        </div>
                    </div>
                    <div className={`p-3.5 rounded-2xl ${bg} ${color} shadow-lg backdrop-blur-md border border-white/10`}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Users,
    Mail,
    MessageCircle,
    Phone,
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
import { LMLoader } from "@/components/lm-loader";
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
            if (!lead["W.P_1"]) return;
            // Match chat page leadsInRange logic: wp1_parsed_date in range, or no date info
            const t = lead.wp1_parsed_date ? new Date(lead.wp1_parsed_date).getTime() : null;
            const inRange = !t || (t >= rangeFrom && t <= rangeTo);
            if (!inRange) return;

            unique++;

            const wp = lead.WP_Replied_track || lead["WP_Replied_track"];
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
    const replyRate = totalWaReachouts > 0 ? ((totalWaReplies / totalWaReachouts) * 100).toFixed(1) : '0';

    const realServiceDistribution = [
        { name: 'Email', value: 0, color: '#3b82f6' },
        { name: 'WhatsApp', value: totalWaReachouts, color: '#10b981' },
        { name: 'Voice', value: m?.totalVoiceCalls ?? 0, color: '#8b5cf6' },
    ];

    const router = useRouter();

    return (
        <div className="space-y-8 pb-10 relative min-h-[500px]">
            {loading && <LMLoader />}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Master Overview</h1>
                    <p className="text-slate-500">Holistic view of all your marketing channels performance.</p>
                </div>
                <DateRangePicker onUpdate={({ range }) => setDateRange(range)} />
            </div>

            {/* Top Metric Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <MetricCard
                    title="Total Leads"
                    value={loading ? "..." : (m?.totalLeads ?? 0).toLocaleString()}
                    change={m?.oldestLeadDate ? `Since ${format(new Date(m.oldestLeadDate), 'MMM d')}` : "Real-time"}
                    isUp={true}
                    icon={<Users className="h-6 w-6" />}
                    color="text-blue-600"
                    bg="bg-blue-50"
                    border="border-blue-100"
                    onClick={() => router.push('/dashboard/leads')}
                />
                <MetricCard
                    title="Total Emails Sent"
                    value="—"
                    change="Real-time"
                    isUp={true}
                    icon={<Mail className="h-6 w-6" />}
                    color="text-emerald-600"
                    bg="bg-emerald-50"
                    border="border-emerald-100"
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricCard
                    title="Total Whatsapp Reachouts"
                    value={loading ? "..." : totalWaReachouts.toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<MessageCircle className="h-6 w-6" />}
                    color="text-purple-600"
                    bg="bg-purple-50"
                    border="border-purple-100"
                    onClick={() => router.push('/dashboard/whatsapp/chat')}
                />
                <MetricCard
                    title="Total Voice Calls"
                    value={loading ? "..." : (m?.totalVoiceCalls ?? 0).toLocaleString()}
                    change="Real-time"
                    isUp={true}
                    icon={<Activity className="h-6 w-6" />}
                    color="text-orange-600"
                    bg="bg-orange-50"
                    border="border-orange-100"
                    onClick={() => router.push('/dashboard/voice')}
                    info="This shows Normal calls containing US, UK, UAE, 1731 leads, openhouse leads."
                />
                <MetricCard
                    title="Total Replies"
                    value={loading ? "..." : totalWaReplies.toLocaleString()}
                    change={`${replyRate}% Rate`}
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
                        className="h-8 w-8 text-slate-400 hover:text-slate-600"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsRepliesExpanded(!isRepliesExpanded);
                        }}
                    >
                        {isRepliesExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>}
                />
            </div>

            {/* Owner Leads Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                        <Users className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Owner Leads Data</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                        title="Total Owner Leads"
                        value={loading ? "..." : (m?.totalOwnerLeads ?? 0).toLocaleString()}
                        change="Real-time"
                        isUp={true}
                        icon={<Users className="h-6 w-6" />}
                        color="text-amber-600"
                        bg="bg-amber-50"
                        border="border-amber-100"
                    />
                    <MetricCard
                        title="Total Whatsapp Reachouts (owner)"
                        value={loading ? "..." : (m?.ownerWaReachouts ?? 0).toLocaleString()}
                        change="Real-time"
                        isUp={true}
                        icon={<MessageCircle className="h-6 w-6" />}
                        color="text-emerald-600"
                        bg="bg-emerald-50"
                        border="border-emerald-100"
                    />
                    <MetricCard
                        title="Total Voice Calls (owner)"
                        value={loading ? "..." : (m?.ownerVoiceCalls ?? 0).toLocaleString()}
                        change="Real-time"
                        isUp={true}
                        icon={<Phone className="h-6 w-6" />}
                        color="text-blue-600"
                        bg="bg-blue-50"
                        border="border-blue-100"
                        info="This count is derived from real-time Vapi call logs for the 'owners' account."
                    />
                    <MetricCard
                        title="Total Replies (owner)"
                        value={loading ? "..." : (m?.ownerWaReplies ?? 0).toLocaleString()}
                        change="Real-time"
                        isUp={true}
                        icon={<MessageCircle className="h-6 w-6" />}
                        color="text-purple-600"
                        bg="bg-purple-50"
                        border="border-purple-100"
                    />
                </div>
            </div>

            {/* Expanded Replies View */}
            {isRepliesExpanded && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Total Replies Details</h2>
                            <p className="text-sm text-slate-500">Detailed view of all replies across channels</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setIsRepliesExpanded(false)}>
                            <X className="h-4 w-4 mr-2" />
                            Close
                        </Button>
                    </div>
                    <TotalRepliesView leads={waReplyLeads} dateRange={dateRange} onViewLead={(lead) => { setIsRepliesExpanded(false); setChatLead(lead); }} />
                </div>
            )}

            {/* Replies Modal */}
            <Dialog open={isRepliesModalOpen} onOpenChange={setIsRepliesModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Total Replies - Detailed View</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <TotalRepliesView leads={waReplyLeads} dateRange={dateRange} onViewLead={(lead) => { setIsRepliesModalOpen(false); setChatLead(lead); }} />
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
                <Card className="lg:col-span-2 border-slate-200 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
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

                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                                <PieChartIcon className="h-5 w-5" />
                            </div>
                            <CardTitle className="text-lg">Response Performance</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 flex flex-col items-center justify-center">
                        <div className="w-full" style={{ height: 300, minHeight: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={realServiceDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {realServiceDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
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
            className={`bg-white border ${border} shadow-sm overflow-hidden relative group hover:shadow-md transition-all duration-300 ${onClick ? 'cursor-pointer' : ''}`}
            onClick={onClick}
        >
            <CardContent className="p-6">
                <div className="flex items-start justify-between relative z-10">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mr-2">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold text-slate-500 mb-1">{title}</p>
                                {info && (
                                    <UITooltipProvider>
                                        <UITooltip>
                                            <UITooltipTrigger asChild>
                                                <Info className="h-7 w-7 text-red-500 mb-1 cursor-help hover:text-red-600 transition-colors" />
                                            </UITooltipTrigger>
                                            <UITooltipContent className="max-w-[250px] bg-slate-900 text-white border-none p-3 shadow-xl">
                                                <p className="text-[11px] leading-relaxed">{info}</p>
                                            </UITooltipContent>
                                        </UITooltip>
                                    </UITooltipProvider>
                                )}
                            </div>
                            {action && <div className="z-20">{action}</div>}
                        </div>
                        <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
                        <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${isUp ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {change}
                        </div>
                    </div>
                    <div className={`p-4 rounded-2xl ${bg} ${color} shadow-sm`}>
                        {icon}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Send, Inbox, LayoutDashboard, RefreshCw, BarChart2, UserMinus, Database, CheckCircle2, TrendingUp, Layers } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { subDays } from "date-fns";
import { useData } from "@/context/DataContext";
import { LMLoader } from "@/components/ryan-loader";

export default function EmailDashboardPage() {
    const router = useRouter();
    const [selectedTableMetric, setSelectedTableMetric] = useState("naples");
    const [dateSubtitle, setDateSubtitle] = useState("all time");

    const { leads: allLeads, loadingLeads } = useData();
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });
    const loading = loadingLeads;

    const [data, setData] = useState({
        totalEmails: 0,
        firstEmail: 0,
        totalReplies: 0,
        totalUnsubscribed: 0,
        tableStats: {
            naples: { name: "Naples (naples_activity)", emails: 0, replies: 0, unsubscribed: 0 },
            aspen: { name: "Aspen (aspen_activity)", emails: 0, replies: 0, unsubscribed: 0 },
            old: { name: "Old Leads (old_activity)", emails: 0, replies: 0, unsubscribed: 0 },
            fello: { name: "Fello (fello_activity)", emails: 0, replies: 0, unsubscribed: 0 },
        }
    });

    const parseMsg = (raw: any): { date: Date | null, content: string } => {
        if (!raw || !String(raw).trim()) return { date: null, content: "" };
        const content = String(raw).trim();
        const isoRegex = /\n\n(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.+)$/;
        const isoMatch = content.match(isoRegex);
        if (isoMatch) {
            return {
                date: new Date(isoMatch[1]),
                content: content.replace(isoRegex, '').trim()
            };
        }
        const lines = content.split('\n');
        const lastLine = lines[lines.length - 1].trim();
        const lastLineDate = new Date(lastLine.replace(' ', 'T'));
        if (lines.length > 1 && !isNaN(lastLineDate.getTime()) && lastLine.includes('-') && lastLine.includes(':')) {
            return {
                date: lastLineDate,
                content: lines.slice(0, -1).join('\n').trim()
            };
        }
        return { date: null, content: content };
    };

    const getLeadSourceTable = (lead: any): 'naples' | 'aspen' | 'old' | 'fello' => {
        const src = String(lead._source_table || lead.source_table || lead.sourceTable || lead.source_loop || lead.source || '').toLowerCase();
        if (src.includes('naples')) return 'naples';
        if (src.includes('aspen')) return 'aspen';
        if (src.includes('old') || src.includes('master')) return 'old';
        if (src.includes('fello')) return 'fello';
        return 'naples';
    };

    useEffect(() => {
        const calculateStats = async () => {
            if (loadingLeads) return;

            try {
                const fromD = dateRange?.from ? new Date(dateRange.from) : null;
                const toD = dateRange?.to ? new Date(dateRange.to) : fromD;
                if (fromD) fromD.setHours(0, 0, 0, 0);
                if (toD) toD.setHours(23, 59, 59, 999);

                const checkEmailDate = (d: Date | null) => {
                    if (!fromD || !toD) return true;
                    if (!d) return false;
                    return d >= fromD && d <= toD;
                };

                let totalEmails = 0;
                let firstEmailCount = 0;
                let replyCount = 0;
                let unsubscribedCount = 0;

                const tableStats = {
                    naples: { name: "Naples (naples_activity)", emails: 0, replies: 0, unsubscribed: 0 },
                    aspen: { name: "Aspen (aspen_activity)", emails: 0, replies: 0, unsubscribed: 0 },
                    old: { name: "Old Leads (old_activity)", emails: 0, replies: 0, unsubscribed: 0 },
                    fello: { name: "Fello (fello_activity)", emails: 0, replies: 0, unsubscribed: 0 },
                };

                allLeads.forEach((lead: any) => {
                    const stageData = lead.stage_data || {};
                    const stages = lead.stages_passed || [];
                    const tableKey = getLeadSourceTable(lead);

                    // --- REPLIES ---
                    const emailReply = lead.email_replied;
                    if (emailReply && !["no", "none", ""].includes(String(emailReply).toLowerCase().trim())) {
                        const parsed = parseMsg(emailReply);
                        const rDate = parsed.date || new Date(lead.updated_at || lead.created_at);
                        if (checkEmailDate(rDate)) {
                            replyCount++;
                            tableStats[tableKey].replies++;
                        }
                    }

                    // --- UNSUBS ---
                    if (lead.unsubscribed && String(lead.unsubscribed).toLowerCase().includes("yes")) {
                        if (checkEmailDate(new Date(lead.updated_at || lead.created_at))) {
                            unsubscribedCount++;
                            tableStats[tableKey].unsubscribed++;
                        }
                    }

                    // --- EMAIL TRANSMISSIONS ---
                    stages.forEach((stage: string) => {
                        const s = stage.toLowerCase().trim();
                        if (!s.startsWith("email_")) return;

                        const rawContent = stageData[stage];
                        let emailDate = parseMsg(rawContent).date || new Date(lead.created_at);

                        if (checkEmailDate(emailDate)) {
                            totalEmails++;
                            tableStats[tableKey].emails++;
                            if (s === "email_1") firstEmailCount++;
                        }
                    });
                });

                setData({
                    totalEmails: totalEmails,
                    firstEmail: firstEmailCount,
                    totalReplies: replyCount,
                    totalUnsubscribed: unsubscribedCount,
                    tableStats
                });

            } catch (e) {
                console.error("Dashboard calculation error", e);
            }
        };

        calculateStats();
    }, [dateRange, allLeads, loadingLeads]);

    const handleDateUpdate = (range: any) => {
        setDateRange(range.range);
        if (range.label) {
            setDateSubtitle(range.label.toLowerCase() === "today" ? "sent today" : `sent ${range.label.toLowerCase()}`);
        } else {
            setDateSubtitle("sent in selected range");
        }
    };

    // Derived Data for Metric Card
    const tableMetricData = {
        naples: { value: data.tableStats.naples.emails, label: "Naples Emails Sent", iconColor: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
        aspen: { value: data.tableStats.aspen.emails, label: "Aspen Emails Sent", iconColor: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/20" },
        old: { value: data.tableStats.old.emails, label: "Old Leads Emails Sent", iconColor: "text-purple-400", bgColor: "bg-purple-500/10 border-purple-500/20" },
        fello: { value: data.tableStats.fello.emails, label: "Fello Emails Sent", iconColor: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20" },
    };
    const currentMetric = tableMetricData[selectedTableMetric as keyof typeof tableMetricData] || tableMetricData.naples;

    return (
        <div className="space-y-8 pb-10 relative min-h-[500px]">
            {loading && <LMLoader />}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Email Marketing Center</h1>
                    <p className="text-[var(--label-secondary)]">Monitor your campaigns and inbox health across Naples, Aspen, Old Leads, and Fello</p>
                </div>
                <DateRangePicker onUpdate={handleDateUpdate} />
            </div>

            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                <MetricCard
                    title="Total Emails"
                    subtitle={dateSubtitle}
                    value={data.totalEmails}
                    icon={<Mail className="h-6 w-6 text-indigo-400" />}
                    bg="bg-indigo-500/10 border-indigo-500/20"
                    onClick={() => router.push('/dashboard/email/sent')}
                />
                <MetricCard
                    title="Initial Reachout"
                    subtitle={dateSubtitle}
                    value={data.firstEmail}
                    icon={<Send className="h-6 w-6 text-blue-400" />}
                    bg="bg-blue-500/10 border-blue-500/20"
                />

                {/* Dynamic Table Card */}
                <Card className="border-[var(--separator)] hover:shadow-[var(--glass-shadow)] transition-all cursor-pointer bg-[var(--glass-fill)]">
                    <CardContent className="p-6 flex flex-col justify-between h-full">
                        <div className="flex items-center justify-between mb-2">
                            <Select value={selectedTableMetric} onValueChange={setSelectedTableMetric}>
                                <SelectTrigger className="w-[140px] h-8 text-xs font-medium border-[var(--separator)]">
                                    <SelectValue placeholder="Select Table" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="naples">Naples</SelectItem>
                                    <SelectItem value="aspen">Aspen</SelectItem>
                                    <SelectItem value="old">Old Leads</SelectItem>
                                    <SelectItem value="fello">Fello</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className={`p-2 rounded-xl border ${currentMetric.bgColor}`}>
                                <Database className={`h-5 w-5 ${currentMetric.iconColor}`} />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-[var(--label-primary)]">{currentMetric.value}</h3>
                            <p className="text-xs text-[var(--label-secondary)]">{currentMetric.label}</p>
                        </div>
                    </CardContent>
                </Card>

                <MetricCard
                    title="Total Replies"
                    subtitle="All time"
                    value={data.totalReplies}
                    icon={<Inbox className="h-6 w-6 text-sky-400" />}
                    bg="bg-sky-500/10 border-sky-500/20"
                    onClick={() => router.push('/dashboard/email/received')}
                />

                <MetricCard
                    title="Unsubscribed"
                    subtitle="All time"
                    value={data.totalUnsubscribed}
                    icon={<UserMinus className="h-6 w-6 text-rose-400" />}
                    bg="bg-rose-500/10 border-rose-500/20"
                    onClick={() => router.push('/dashboard/email/unsubscribed')}
                />
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
                        stats={data.tableStats.naples}
                        badgeColor="bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        accentColor="#34c759"
                    />
                    <TablePerformanceCard
                        tableName="Aspen"
                        tableKey="aspen_activity"
                        stats={data.tableStats.aspen}
                        badgeColor="bg-amber-500/15 text-amber-400 border-amber-500/30"
                        accentColor="#f59e0b"
                    />
                    <TablePerformanceCard
                        tableName="Old Leads"
                        tableKey="old_activity"
                        stats={data.tableStats.old}
                        badgeColor="bg-purple-500/15 text-purple-400 border-purple-500/30"
                        accentColor="#8b5cf6"
                    />
                    <TablePerformanceCard
                        tableName="Fello"
                        tableKey="fello_activity"
                        stats={data.tableStats.fello}
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
                                <TableHead>Unsubscribed</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.entries(data.tableStats).map(([key, item]) => {
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
                                        <TableCell className="font-medium text-rose-400">{item.unsubscribed}</TableCell>
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

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--separator)] text-center">
                    <div>
                        <span className="text-xs text-[var(--label-tertiary)] block">Sent</span>
                        <span className="text-base font-bold text-[var(--label-primary)]">{stats.emails}</span>
                    </div>
                    <div>
                        <span className="text-xs text-[var(--label-tertiary)] block">Replies</span>
                        <span className="text-base font-bold text-emerald-400">{stats.replies}</span>
                    </div>
                    <div>
                        <span className="text-xs text-[var(--label-tertiary)] block">Unsub</span>
                        <span className="text-base font-bold text-rose-400">{stats.unsubscribed}</span>
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

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Search,
    Filter,
    Mail,
    ChevronDown,
    ChevronUp,
    ArrowRight,
    ArrowLeft,
    Reply,
    User,
    Bot,
    ExternalLink,
    MessageSquare,
    Share2
} from "lucide-react";
import React, { useState, useEffect } from "react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { format, subDays } from "date-fns";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useData } from "@/context/DataContext";
import { FollowUpBossButton } from "@/components/ui/followup-boss-button";
import { LMLoader } from "@/components/ryan-loader";
import { EmailChatDetail } from "@/components/dashboard/email-chat-detail";

const ITEMS_PER_PAGE = 7;

export default function SentEmailsPage() {
    const { leads: allLeads, loadingLeads } = useData();
    const [page, setPage] = useState(1);
    const [selectedLeadItem, setSelectedLeadItem] = useState<{ id: string; initialLead?: any } | null>(null);
    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 90),
        to: new Date(),
    });
    const [sentEmails, setSentEmails] = useState<any[]>([]);
    const loading = loadingLeads;
    const [searchQuery, setSearchQuery] = useState("");
    const [filters, setFilters] = useState({
        campaign: "all",
        sender: "all",
        type: "all",
    });

    useEffect(() => {
        const fetchData = async () => {
            if (loadingLeads) return;

            try {
                const emails: any[] = [];
                const seenKeys = new Set<string>();

                const addEmailIfUnique = (emailObj: any) => {
                    const dbId = emailObj.rawLead?.id ? String(emailObj.rawLead.id) : null;
                    const table = emailObj.rawLead?._source_table || '';
                    const signature = `${table}|${emailObj.recipient?.toLowerCase()}|${emailObj.type?.toLowerCase()}|${emailObj.sentDate}`;

                    if (dbId && seenKeys.has(`id-${table}-${dbId}`)) return;
                    if (seenKeys.has(signature)) return;

                    if (dbId) seenKeys.add(`id-${table}-${dbId}`);
                    seenKeys.add(signature);

                    emails.push(emailObj);
                };

                allLeads.forEach((lead: any, leadIndex: number) => {
                    const channel = String(lead.channel || '').toLowerCase();
                    const actionType = String(lead.action_type || '').toLowerCase();
                    const status = String(lead.status || '').toLowerCase();

                    // --- Activity Table Record Mapping ---
                    if (lead._source_table || channel) {
                        const isEmail = channel.includes('email') || actionType.includes('email') || !!lead.lead_email || !!lead.email;
                        if (isEmail && channel !== 'voice' && channel !== 'whatsapp' && channel !== 'sms') {
                            const eDate = lead.created_at || lead.updated_at ? new Date(lead.created_at || lead.updated_at) : new Date();
                            let sentDate = "Unknown Date";
                            try { sentDate = format(eDate, "MMM dd, yyyy • p"); } catch (_) {}

                            addEmailIfUnique({
                                id: lead.id ? `act-sent-${lead._source_table || 'tbl'}-${lead.id}` : `act-sent-${leadIndex}`,
                                recipient: lead.lead_email || lead.email || lead.lead_name || lead.name || "Recipient",
                                sender: lead.vapi_account || lead.source || lead.workflow_name || "Email Sender",
                                type: lead.action_type || "Outbound Email",
                                sentDate,
                                subject: lead.content ? (lead.content.split('\n')[0] || "Outbound Email") : "Outbound Email",
                                body: lead.content || lead.note || "Outbound email sent",
                                content: lead.content || lead.note || "Outbound email sent",
                                rawDate: eDate.toISOString(),
                                campaign: lead._source_table || lead.workflow_name || lead.campaign || "Activity Stream",
                                hasReplied: status.includes('reply') || !!lead.replied_at,
                                replyContent: null,
                                replyDate: null,
                                rawLead: lead,
                            });
                        }
                        return;
                    }

                    const stages = lead.stages_passed || [];

                    // --- Build sender display string ---
                    let sEmail = (lead.sender_email || lead["Sender Email"] || "").trim();
                    let sName = (lead.sender_name || lead["Sender Name"] || "").trim();
                    let extractedEmail = sEmail;
                    let extractedNameFromEmail = "";
                    if (sEmail.includes("<") && sEmail.includes(">")) {
                        const m = sEmail.match(/^(.*?)<(.*?)>$/);
                        if (m) {
                            extractedNameFromEmail = m[1].trim().replace(/^"|"$/g, "");
                            extractedEmail = m[2].trim();
                        }
                    }
                    const displayName = sName || extractedNameFromEmail || "";
                    const displayEmail = extractedEmail || sEmail || "";
                    let fullSender = "";
                    if (displayName && displayEmail && displayEmail.includes("@")) {
                        fullSender =
                            displayName.toLowerCase() === displayEmail.toLowerCase()
                                ? displayEmail
                                : `${displayName} (${displayEmail})`;
                    } else {
                        fullSender = displayName || displayEmail || "Unknown Sender";
                    }
                    if (fullSender.includes("<>")) fullSender = fullSender.replace("<>", "").trim();

                    // --- Has this lead replied via email? ---
                    const emailReply = lead.email_replied;
                    const hasReplied = !!(
                        emailReply &&
                        emailReply !== "No" &&
                        String(emailReply).trim() !== ""
                    );

                    // --- Iterate email stages in order ---
                    stages.forEach((stage: string) => {
                        if (!stage.startsWith("Email_")) return;

                        const rawContent = lead.stage_data?.[stage];

                        let rawDateValue: string | null = lead.created_at || null;
                        let emailBody = "Email sent – no content stored.";
                        let sentDate: string | null = null;

                        if (rawContent && typeof rawContent === "string") {
                            const trimmed = rawContent.trim();
                            const lines = trimmed.split("\n");
                            const lastLine = lines[lines.length - 1].trim();
                            const fullDate = new Date(trimmed);
                            const lastLineDate = new Date(lastLine);

                            if (!isNaN(fullDate.getTime()) && trimmed.length < 50) {
                                rawDateValue = fullDate.toISOString();
                                sentDate = format(fullDate, "MMM dd, yyyy • p");
                                emailBody = "Email sent";
                            } else if (
                                !isNaN(lastLineDate.getTime()) &&
                                lastLine.includes("-") &&
                                lastLine.includes(":")
                            ) {
                                rawDateValue = lastLineDate.toISOString();
                                sentDate = format(lastLineDate, "MMM dd, yyyy • p");
                                emailBody = lines.slice(0, -1).join("\n").trim() || "Email sent";
                            } else {
                                emailBody = rawContent;
                            }
                        }

                        const displayStageType = stage;

                        addEmailIfUnique({
                            id: `${lead.id || `lead-${leadIndex}`}-${stage.replace(/\s+/g, "-")}`,
                            recipient: lead.email || lead.name || `Lead ${leadIndex + 1}`,
                            sender: fullSender,
                            type: displayStageType,
                            sentDate,
                            subject: displayStageType,
                            content: emailBody,
                            body: emailBody,
                            loop: lead.source_loop || "Intro",
                            rawDate: rawDateValue,
                            hasReplied,
                            rawLead: lead,
                        });
                    });
                });

                // --- Fetch directly from /api/activity for full activity table coverage ---
                try {
                    const actRes = await fetch('/api/activity?channel=email&limit=500');
                    if (actRes.ok) {
                        const actData = await actRes.json();
                        const actLogs = actData.activities || [];

                        actLogs.forEach((act: any, idx: number) => {
                            const eDate = act.created_at || act.updated_at ? new Date(act.created_at || act.updated_at) : new Date();
                            let sentDate = "Unknown Date";
                            try { sentDate = format(eDate, "MMM dd, yyyy • p"); } catch (_) {}

                            const status = String(act.status || '').toLowerCase();

                            addEmailIfUnique({
                                id: `act-${act._source_table || 'tbl'}-${act.id || idx}`,
                                recipient: act.lead_email || act.email || act.lead_name || act.customer_name || "Recipient",
                                sender: act.vapi_account || act.source || act.workflow_name || "Email Sender",
                                type: act.action_type || "Outbound Email",
                                sentDate,
                                subject: act.content ? (act.content.split('\n')[0] || "Outbound Email") : "Outbound Email",
                                body: act.content || act.note || "Outbound email sent",
                                content: act.content || act.note || "Outbound email sent",
                                rawDate: eDate.toISOString(),
                                campaign: act._source_table || act.workflow_name || act.source || "Activity Stream",
                                hasReplied: status.includes('reply') || !!act.replied_at,
                                replyContent: null,
                                replyDate: null,
                                rawLead: act,
                            });
                        });
                    }
                } catch (e) {
                    console.error("Error fetching direct activity in SentEmailsPage:", e);
                }

                // Sort newest first
                emails.sort(
                    (a, b) =>
                        new Date(b.rawDate || 0).getTime() - new Date(a.rawDate || 0).getTime()
                );
                setSentEmails(emails);
            } catch (err) {
                console.error("Sent emails processing error", err);
            }
        };
        fetchData();
    }, [allLeads, loadingLeads]);

const SENDER_EMAILS = [
    "matt@napleshomes.com",
    "jen@napleshomes.com",
    "matt@aspen.realestate",
    "mia@aspen.realestate",
];

    // Dynamic filter options derived from actual database records
    const uniqueCampaigns = Array.from(
        new Set(sentEmails.map((e) => e.campaign).filter(Boolean))
    ).sort();

    const uniqueTypes = Array.from(
        new Set(sentEmails.map((e) => e.type).filter(Boolean))
    ).sort();

    const handleFilterChange = (key: string, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const filteredEmails = sentEmails.filter((email) => {
        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (
                !email.recipient.toLowerCase().includes(q) &&
                !email.subject.toLowerCase().includes(q) &&
                !email.content.toLowerCase().includes(q)
            )
                return false;
        }

        // Date range
        if (dateRange?.from && email.rawDate) {
            const ed = new Date(email.rawDate);
            if (!isNaN(ed.getTime())) {
                const from = new Date(dateRange.from);
                from.setHours(0, 0, 0, 0);
                const to = dateRange.to ? new Date(dateRange.to) : new Date(from);
                to.setHours(23, 59, 59, 999);
                if (ed < from || ed > to) return false;
            }
        }

        // Campaign filter (exact match against DB campaign / source table)
        if (filters.campaign !== "all" && email.campaign !== filters.campaign) {
            return false;
        }

        // Sender filter (matches selected email in email.sender)
        if (filters.sender !== "all") {
            const sLower = (email.sender || "").toLowerCase();
            if (!sLower.includes(filters.sender.toLowerCase())) {
                return false;
            }
        }

        // Type filter (exact match against DB action_type / stage)
        if (filters.type !== "all" && email.type !== filters.type) {
            return false;
        }

        return true;
    });

    const totalPages = Math.ceil(filteredEmails.length / ITEMS_PER_PAGE);
    const paginatedEmails = filteredEmails.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    return (
        <div className="space-y-6 pb-10 max-w-5xl mx-auto relative min-h-[500px]">
            {loading && <LMLoader />}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--label-primary)]">Sent Emails</h1>
                    <p className="text-[var(--label-secondary)]">View and manage your sent email history.</p>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-[var(--glass-fill)] p-4 rounded-xl border border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--label-tertiary)]" />
                        <Input
                            placeholder="Search recipients, subjects..."
                            className="pl-9 bg-[var(--bg-app)] border-[var(--separator)]"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <DateRangePicker
                        className="w-full md:w-[260px]"
                        onUpdate={(values) => setDateRange(values.range)}
                    />
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                    <Filter className="h-4 w-4 text-[var(--label-tertiary)] mr-2" />

                    {/* Dynamic Campaign Filter */}
                    <Select value={filters.campaign} onValueChange={(val) => handleFilterChange("campaign", val)}>
                        <SelectTrigger className="w-[180px] h-9 text-xs">
                            <SelectValue placeholder="All Campaigns" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Campaigns</SelectItem>
                            {uniqueCampaigns.map((camp) => (
                                <SelectItem key={camp} value={camp}>
                                    {camp}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Sender Filter */}
                    <Select value={filters.sender} onValueChange={(val) => handleFilterChange("sender", val)}>
                        <SelectTrigger className="w-[200px] h-9 text-xs">
                            <SelectValue placeholder="All Senders" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Senders</SelectItem>
                            {SENDER_EMAILS.map((sender) => (
                                <SelectItem key={sender} value={sender}>
                                    {sender}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Dynamic Type Filter */}
                    <Select value={filters.type} onValueChange={(val) => handleFilterChange("type", val)}>
                        <SelectTrigger className="w-[180px] h-9 text-xs">
                            <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {uniqueTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {type}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-[var(--label-secondary)] h-9 text-xs ml-auto bg-[var(--fill-quaternary)] hover:bg-[var(--fill-tertiary)]"
                        onClick={() => {
                            setSearchQuery("");
                            setDateRange(undefined);
                            setFilters({ campaign: "all", sender: "all", type: "all" });
                            setPage(1);
                        }}
                    >
                        Reset All Filters
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {!loading && paginatedEmails.length > 0 ? (
                    paginatedEmails.map((email) => (
                        <SentEmailCard
                            key={email.id}
                            email={email}
                            onOpenThread={(id, initialLead) => setSelectedLeadItem({ id, initialLead })}
                        />
                    ))
                ) : !loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-[var(--label-tertiary)] border border-dashed border-[var(--separator)] rounded-xl bg-[var(--bg-app)]/50">
                        <Mail className="h-8 w-8 mb-2 opacity-50" />
                        <p>No emails found matching your filters</p>
                    </div>
                ) : null}
            </div>

            {/* Pagination */}
            {!loading && filteredEmails.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-4 border-t border-[var(--separator)]">
                    <p className="text-sm text-[var(--label-secondary)]">
                        Showing{" "}
                        <span className="font-medium">{(page - 1) * ITEMS_PER_PAGE + 1}</span>–
                        <span className="font-medium">
                            {Math.min(page * ITEMS_PER_PAGE, filteredEmails.length)}
                        </span>{" "}
                        of <span className="font-medium">{filteredEmails.length}</span> results
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="gap-1"
                        >
                            <ArrowLeft className="h-4 w-4" /> Previous
                        </Button>
                        <span className="text-sm font-medium text-[var(--label-secondary)]">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className="gap-1"
                        >
                            Next <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Email Chat Detail Modal Overlay */}
            {selectedLeadItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-4xl h-[85vh] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                        <EmailChatDetail
                            leadId={selectedLeadItem.id}
                            initialLead={selectedLeadItem.initialLead}
                            onClose={() => setSelectedLeadItem(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

interface ParsedEmailTurn {
    sender: 'agent' | 'user';
    label: string;
    text: string;
    timestamp?: string;
}

function parseCardContent(content: string, note?: string): ParsedEmailTurn[] {
    const raw = (content || note || "").trim();
    if (!raw) return [];

    const turns: ParsedEmailTurn[] = [];

    // Regex matching prefixes like Template:, Agent:, User:, Reply:
    const regex = /(Template:|Agent\s*:|Outbound Email:|Email Sent:|User\s*:|Inbound Email:|Inbound Reply:|Reply:)/gi;
    const matches = Array.from(raw.matchAll(regex));

    if (matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const startIdx = match.index! + match[0].length;
            const endIdx = i < matches.length - 1 ? matches[i + 1].index! : raw.length;
            let block = raw.substring(startIdx, endIdx).trim();

            const prefix = match[0].toLowerCase();
            const isAgent = prefix.includes('template') || prefix.includes('agent') || prefix.includes('outbound') || prefix.includes('sent');

            let timestamp: string | undefined = undefined;
            const tsMatch = block.match(/(\d{1,2}\/\d{1,2}\/\d{4},\s*\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)/i);
            if (tsMatch) {
                timestamp = tsMatch[1];
                block = block.replace(tsMatch[0], '').trim();
            }

            if (block) {
                turns.push({
                    sender: isAgent ? 'agent' : 'user',
                    label: isAgent ? 'AI Agent' : 'User Reply',
                    text: block,
                    timestamp
                });
            }
        }
    } else {
        const parts = raw.split(/(?=\d{1,2}\/\d{1,2}\/\d{4})/g);
        for (const part of parts) {
            let p = part.trim();
            if (!p) continue;
            let timestamp: string | undefined = undefined;
            const tsMatch = p.match(/(\d{1,2}\/\d{1,2}\/\d{4}(?:,\s*\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)?)/i);
            if (tsMatch) {
                timestamp = tsMatch[1];
                p = p.replace(tsMatch[0], '').trim();
            }
            if (p) {
                turns.push({
                    sender: 'agent',
                    label: 'Outbound Email',
                    text: p,
                    timestamp
                });
            }
        }
    }

    if (turns.length === 0 && raw) {
        turns.push({
            sender: 'agent',
            label: 'Email Content',
            text: raw
        });
    }

    return turns;
}

function SentEmailCard({ email, onOpenThread }: { email: any; onOpenThread: (id: string, lead?: any) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const turns = parseCardContent(email?.content, email?.note);
    const firstTurn = turns[0];
    const rawText = firstTurn ? (firstTurn.text || '') : (email?.content || email?.note || '');
    const rawPreview = String(rawText || '').replace(/^(Template:|Agent\s*:|User\s*:)/i, '').trim();
    const previewText = rawPreview.replace(/<(br|p|div|li|h[1-6])[^>]*>/gi, " ").replace(/<\/?[^>]+(>|$)/g, "").trim();

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={setIsOpen}
            className="bg-[#0d121f]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg transition-all hover:border-white/20 overflow-hidden"
        >
            <CollapsibleTrigger asChild>
                <div className="p-5 cursor-pointer group hover:bg-white/[0.02] transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                        <div className="flex items-start gap-4">
                            <div className="h-10 w-10 shrink-0 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/20 mt-0.5">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge
                                        variant="secondary"
                                        className="bg-white/10 text-slate-300 text-[10px] tracking-wider font-bold uppercase border border-white/10"
                                    >
                                        {email.type}
                                    </Badge>
                                    <Badge
                                        variant="outline"
                                        className="text-purple-400 border-purple-500/30 bg-purple-500/10 text-[10px] uppercase font-bold"
                                    >
                                        {email.campaign || email.loop}
                                    </Badge>
                                    {email.hasReplied && (
                                        <Badge
                                            variant="outline"
                                            className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold gap-1"
                                        >
                                            <Reply className="h-3 w-3" /> Replied
                                        </Badge>
                                    )}
                                    {email.sentDate && (
                                        <Badge
                                            variant="outline"
                                            className="text-cyan-400 border-cyan-500/30 bg-cyan-500/10 text-[10px]"
                                        >
                                            {email.sentDate}
                                        </Badge>
                                    )}
                                </div>
                                <h4 className="text-base font-bold text-white">{email.recipient}</h4>
                                {!isOpen && (
                                    <p className="text-xs text-slate-400 truncate max-w-xl">
                                        {previewText.substring(0, 100)}{previewText.length > 100 ? '...' : ''}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <FollowUpBossButton lead={email.rawLead || email} variant="button" />
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const shareId = email.rawLead?.lead_email || email.rawLead?.email || email.recipient || email.id;
                                    onOpenThread(shareId, email.rawLead);
                                }}
                                className="h-8 text-xs gap-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/20 rounded-lg font-semibold"
                            >
                                <MessageSquare className="h-3.5 w-3.5" /> Full Thread
                            </Button>
                            {isOpen ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                            ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-white" />
                            )}
                        </div>
                    </div>
                </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="px-5 pb-5 pt-0">
                    <div className="border-t border-white/10 pt-4 space-y-3">
                        {email.sender && (
                            <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                                <span className="font-semibold text-slate-300">From:</span> {email.sender}
                            </p>
                        )}

                        {/* Structured Conversation Turns */}
                        <div className="space-y-3 mt-3">
                            {turns.map((turn, idx) => {
                                const isAgent = turn.sender === 'agent';
                                return (
                                    <div
                                        key={idx}
                                        className={`p-3.5 rounded-xl border text-xs leading-relaxed transition-all ${
                                            isAgent
                                                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-100'
                                                : 'bg-purple-500/10 border-purple-500/20 text-purple-100'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/10">
                                            <span className={`font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider ${
                                                isAgent ? 'text-emerald-400' : 'text-purple-400'
                                            }`}>
                                                {isAgent ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                                                {turn.label}
                                            </span>
                                            {turn.timestamp && (
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {turn.timestamp}
                                                </span>
                                            )}
                                        </div>
                                        <p className="whitespace-pre-wrap leading-relaxed">{turn.text}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

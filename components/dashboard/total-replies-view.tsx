"use client";

import { useState } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Search, Mail, MessageCircle, Phone, Smartphone } from "lucide-react";
import { FollowUpBossButton } from "@/components/ui/followup-boss-button";

interface ReplyData {
    id: string;
    contactName: string;
    contactInfo: string;
    mode: 'Email' | 'WhatsApp' | 'Voice' | 'SMS';
    date: string;
    time: string;
    status: 'Replied' | 'Pending' | 'Follow-up';
    preview: string;
    rawLead?: any;
}



export function TotalRepliesView({ leads = [], dateRange, onViewLead }: { leads?: any[], dateRange?: { from?: Date, to?: Date } | null, onViewLead?: (lead: any) => void }) {
    const [search, setSearch] = useState("");
    const [modeFilter, setModeFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

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

    // Map real leads to ReplyData format
    const realData: (ReplyData & { link: string; sortDate: Date })[] = [];

    const getValidDate = (d: any): Date => {
        if (!d) return new Date();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) return parsed;
        return new Date();
    };

    leads.forEach((lead: any, idx: number) => {
        let addedCount = 0;
        const fallbackDate = getValidDate(lead.replied_at || lead.updated_at || lead.created_at || lead["Created At"] || lead.createdOn);
        const leadId = lead["Lead ID"] || lead.id || `lead-${idx}`;
        const contactName = lead.name || lead["Name"] || lead.lead_name || lead.customer_name || "Unknown";
        const contactInfo = lead.phone || lead["Phone"] || lead.lead_phone || lead.email || lead["Email"] || lead.lead_email || "No info";

        // --- WhatsApp Logic ---
        let wpReplyObj = { content: "Lead replied via WhatsApp", date: fallbackDate };
        let hasWP = false;

        const wtR = String(lead.WP_Replied_track || lead["WP_Replied_track"] || "").trim();
        if (wtR && wtR.toLowerCase() !== "no" && wtR.toLowerCase() !== "none" && wtR !== "0") {
            hasWP = true;
            const parsed = parseMsg(wtR);
            if (parsed.date) wpReplyObj = { content: parsed.content || wtR, date: parsed.date };
            else wpReplyObj = { content: wtR, date: fallbackDate };
        }

        const addWpReply = (raw: any) => {
            if (!raw) return;
            const s = String(raw).trim();
            if (!s || s.toLowerCase() === "no" || s.toLowerCase() === "none" || s === "0") return;
            hasWP = true;
            const parsed = parseMsg(raw);
            const msgDate = parsed.date || fallbackDate;
            if (msgDate >= wpReplyObj.date) {
                wpReplyObj = { content: parsed.content || s, date: msgDate };
            }
        };

        addWpReply(lead.whatsapp_replied);
        addWpReply(lead["W.P_Replied 1"]);
        for (let i = 1; i <= 10; i++) addWpReply(lead[`W.P_Replied_${i}`]);

        if (hasWP) {
            addedCount++;
            realData.push({
                id: `${leadId}-wp-${idx}`,
                contactName,
                contactInfo,
                mode: 'WhatsApp',
                date: wpReplyObj.date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
                time: wpReplyObj.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'Replied',
                preview: wpReplyObj.content.substring(0, 70) + (wpReplyObj.content.length > 70 ? "..." : ""),
                link: `/dashboard/whatsapp/chat?chat=${leadId}`,
                rawLead: lead,
                sortDate: wpReplyObj.date
            });
        }

        // --- Email Logic ---
        const rawEmail = lead.email_replied || lead["Email Replied"];
        const hasEmail = rawEmail && !["no", "none", "", "0"].includes(String(rawEmail).toLowerCase().trim());

        if (hasEmail) {
            addedCount++;
            const parsed = parseMsg(rawEmail);
            const msgDate = parsed.date || fallbackDate;
            const emailReplyObj = { content: parsed.content || String(rawEmail) || "Lead replied via Email", date: msgDate };

            realData.push({
                id: `${leadId}-email-${idx}`,
                contactName,
                contactInfo: lead.email || lead["Email"] || lead.lead_email || contactInfo,
                mode: 'Email',
                date: emailReplyObj.date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
                time: emailReplyObj.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'Replied',
                preview: emailReplyObj.content.substring(0, 70) + (emailReplyObj.content.length > 70 ? "..." : ""),
                link: `/dashboard/email/sent`,
                rawLead: lead,
                sortDate: emailReplyObj.date
            });
        }

        // --- Fallback for any other replied lead (activity tables, voice, sms) ---
        if (addedCount === 0) {
            const replyDate = getValidDate(lead.replied_at || lead.updated_at || lead.created_at || lead["Created At"]);
            const channel = String(lead.channel || lead._source_table || '').toLowerCase();
            let mode: 'Email' | 'WhatsApp' | 'Voice' | 'SMS' = 'WhatsApp';
            if (channel.includes('email')) mode = 'Email';
            else if (channel.includes('sms')) mode = 'SMS';
            else if (channel.includes('voice') || channel.includes('call') || lead.mode === 'Voice') mode = 'Voice';
            else if (channel.includes('whatsapp') || channel.includes('wp')) mode = 'WhatsApp';
            else if (lead.lead_email && !lead.lead_phone && !lead.phone) mode = 'Email';

            realData.push({
                id: `${leadId}-act-${idx}`,
                contactName,
                contactInfo,
                mode,
                date: replyDate.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }),
                time: replyDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'Replied',
                preview: (lead.content || lead.note || lead.summary || lead.transcript || lead.WP_Replied_track || lead.whatsapp_replied || "Replied").substring(0, 70),
                link: mode === 'WhatsApp' ? `/dashboard/whatsapp/chat?chat=${leadId}` : (mode === 'Voice' ? `/dashboard/voice` : (mode === 'SMS' ? `/dashboard/sms` : `/dashboard/email/sent`)),
                rawLead: lead,
                sortDate: replyDate,
            });
        }
    });

    // Sort heavily by newest reply first
    realData.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

    // Filter logic based on search and mode filter
    const filteredData = realData.filter(item => {
        const matchesSearch = !search ||
            item.contactName.toLowerCase().includes(search.toLowerCase()) ||
            item.contactInfo.toLowerCase().includes(search.toLowerCase()) ||
            item.preview.toLowerCase().includes(search.toLowerCase());
        const matchesMode = modeFilter === "all" || item.mode.toLowerCase() === modeFilter.toLowerCase();
        return matchesSearch && matchesMode;
    });

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const displayedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 items-center gap-2 w-full md:max-w-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--label-secondary)]" />
                        <Input
                            placeholder="Search contacts..."
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Select value={modeFilter} onValueChange={setModeFilter}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Mode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Modes</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                            <SelectItem value="voice">Voice</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-[var(--glass-fill)] overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[var(--bg-app)]">
                            <TableHead>Contact</TableHead>
                            <TableHead>Mode</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Preview</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-center">FUB</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedData.length > 0 ? (
                            displayedData.map((item: any) => (
                                <TableRow
                                    key={item.id}
                                    className="cursor-pointer hover:bg-[var(--bg-app)]/80 transition-colors"
                                    onClick={() => {
                                        if (onViewLead && item.rawLead) {
                                            onViewLead(item.rawLead);
                                        } else {
                                            window.location.href = item.link;
                                        }
                                    }}
                                >
                                    <TableCell>
                                        <div className="font-medium">{item.contactName}</div>
                                        <div className="text-xs text-[var(--label-secondary)]">{item.contactInfo}</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {item.mode === 'Email' && <Mail className="h-4 w-4 text-sky-500" />}
                                            {item.mode === 'WhatsApp' && <MessageCircle className="h-4 w-4 text-green-500" />}
                                            {item.mode === 'Voice' && <Phone className="h-4 w-4 text-purple-500" />}
                                            {item.mode === 'SMS' && <Smartphone className="h-4 w-4 text-amber-500" />}
                                            <span>{item.mode}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{item.date}</div>
                                        <div className="text-xs text-[var(--label-secondary)]">{item.time}</div>
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={item.preview}>
                                        {item.preview}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={item.status === 'Replied' ? 'default' : item.status === 'Pending' ? 'secondary' : 'outline'}>
                                            {item.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                        <FollowUpBossButton lead={item.rawLead || item} variant="icon" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No results found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--label-secondary)]">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-sm font-medium">Page {currentPage} of {Math.max(1, totalPages)}</div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

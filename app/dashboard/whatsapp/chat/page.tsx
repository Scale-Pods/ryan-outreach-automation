"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { WhatsAppChatDetail } from "@/components/dashboard/whatsapp-chat-detail";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Search,
    Filter,
    Users,
    Send,
    MessageSquare,
    RefreshCw,
    Building2
} from "lucide-react";
import { LMLoader } from "@/components/ryan-loader";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

// --- Sorting & Activity Helpers ---
const parseMsg = (raw: any): { date: Date | null, content: string } => {
    if (!raw || !String(raw).trim()) return { date: null, content: "" };
    const content = String(raw).trim();

    // 1. Direct ISO (e.g. "2026-04-29T10:30:00.000Z")
    if (content.length >= 10 && !isNaN(new Date(content).getTime())) {
        if (content.includes('T') || (content.includes('-') && content.includes(':'))) {
            return { date: new Date(content), content: "" };
        }
    }

    // 2. ISO at the end (with any number of newlines/spaces)
    const isoRegex = /[\n\s]+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*)$/;
    const isoMatch = content.match(isoRegex);
    if (isoMatch) {
        const d = new Date(isoMatch[1]);
        if (!isNaN(d.getTime())) {
            return { date: d, content: content.replace(isoRegex, '').trim() };
        }
    }

    // 3. Space-separated datetime at the end (e.g. "2026-04-29 10:30:00")
    const lines = content.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    if (lastLine.includes('-') && lastLine.includes(':')) {
        const lastLineDate = new Date(lastLine.replace(' ', 'T'));
        if (!isNaN(lastLineDate.getTime())) {
            return {
                date: lastLineDate,
                content: lines.length > 1 ? lines.slice(0, -1).join('\n').trim() : content
            };
        }
    }

    // 4. DD/MM/YYYY at end of content
    const ddmmRegex = /(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/;
    const ddmmMatch = content.match(ddmmRegex);
    if (ddmmMatch) {
        const d = new Date(Number(ddmmMatch[3]), Number(ddmmMatch[2]) - 1, Number(ddmmMatch[1]));
        if (!isNaN(d.getTime())) {
            return { date: d, content: content.replace(ddmmRegex, '').trim() };
        }
    }

    return { date: null, content: content };
};

const getMsgDate = (raw: any) => {
    return parseMsg(raw).date;
};

// Parse a date from the TS column (e.g. "Delivered - 29/04/2026", "Read - 29/4/2026 10:30:00 AM")
const parseTSDate = (tsValue: string): Date | null => {
    if (!tsValue) return null;
    const str = String(tsValue).trim();

    // Format: "Status - DD/MM/YYYY" or "Status - DD/MM/YYYY HH:MM:SS"
    if (str.includes(' - ')) {
        const parts = str.split(' - ');
        const datePart = parts[parts.length - 1].trim();

        // Try DD/MM/YYYY
        const ddmmMatch = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (ddmmMatch) {
            const day = Number(ddmmMatch[1]);
            const month = Number(ddmmMatch[2]) - 1;
            const year = Number(ddmmMatch[3]);
            // Check for time portion after the date
            const timeMatch = datePart.match(/(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?/i);
            if (timeMatch) {
                let hours = Number(timeMatch[1]);
                const mins = Number(timeMatch[2]);
                const secs = Number(timeMatch[3] || 0);
                if (timeMatch[4]?.toUpperCase() === 'PM' && hours < 12) hours += 12;
                if (timeMatch[4]?.toUpperCase() === 'AM' && hours === 12) hours = 0;
                return new Date(year, month, day, hours, mins, secs);
            }
            return new Date(year, month, day);
        }

        // Try ISO format
        const isoDate = new Date(datePart.replace(' ', 'T'));
        if (!isNaN(isoDate.getTime())) return isoDate;
    }
    return null;
};

const getMsgDateWithFallback = (lead: any, msgKey: string, tsKey?: string) => {
    // 1. Try parsing from message content
    const msgContent = lead[msgKey] || lead.stage_data?.[msgKey];
    const d = getMsgDate(msgContent);
    if (d) return d;

    // 2. Try parsing from TS column
    const resolvedTsKey = tsKey || `${msgKey} TS`;
    const tsValue = lead[resolvedTsKey];
    const tsDate = parseTSDate(tsValue);
    if (tsDate) return tsDate;

    // 3. If the message EXISTS but we couldn't parse a date from content or TS,
    //    fall back to the lead's "Created At" as the message date.
    //    This is critical: without this, leads with non-timestamped messages
    //    are silently dropped from date-filtered views.
    if (msgContent && String(msgContent).trim() !== "" && String(msgContent).trim().toLowerCase() !== "no") {
        const createdAt = lead.created_at ? new Date(lead.created_at) : null;
        if (createdAt && !isNaN(createdAt.getTime())) return createdAt;
    }

    return null;
};

const getLeadLatestActivity = (lead: any) => {
    // WA endpoint uses "Created At" (DB column name); consolidated leads use created_at
    const createdRaw = lead["Created At"] || lead.created_at;
    let latestDate = createdRaw ? new Date(createdRaw) : new Date(0);
    // wp1_parsed_date is the most reliable WA send date — use it as the floor
    if (lead.wp1_parsed_date) {
        const d = new Date(lead.wp1_parsed_date);
        if (!isNaN(d.getTime()) && d > latestDate) latestDate = d;
    }

    // Check all bot messages (W.P_1 - W.P_12)
    for (let i = 1; i <= 12; i++) {
        const d = getMsgDateWithFallback(lead, `W.P_${i}`);
        if (d && d > latestDate) latestDate = d;
    }

    // Check reply (legacy and new track)
    const rd = getMsgDate(lead.whatsapp_replied || lead.stage_data?.["WhatsApp Replied"]);
    if (rd && rd > latestDate) latestDate = rd;

    const rt = getMsgDate(lead.WP_Replied_track);
    if (rt && rt > latestDate) latestDate = rt;

    // Check followup
    const fd = getMsgDateWithFallback(lead, "W.P_FollowUp", "W.P_FollowUp TS");
    if (fd && fd > latestDate) latestDate = fd;

    // Check extended history (W.P_Replied 1-10, W.P_FollowUp 1-10)
    for (let i = 1; i <= 10; i++) {
        const dReplied = getMsgDate(lead[`W.P_Replied_${i}`]);
        if (dReplied && dReplied > latestDate) latestDate = dReplied;

        const dFollow = getMsgDateWithFallback(lead, `W.P_FollowUp_${i}`, `W.P_FollowUp_${i} TS`);
        if (dFollow && dFollow > latestDate) latestDate = dFollow;
    }
    return latestDate;
};

// Extract ISO timestamp embedded in Whatsapp_1 message text, fall back to Whatsapp_1_Date
const extractOwnerWADate = (o: any): Date | null => {
    const text = o["Whatsapp_1"];
    if (text) {
        const m = String(text).match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s\n]*)/);
        if (m) { const d = new Date(m[1]); if (!isNaN(d.getTime())) return d; }
    }
    const dateField = o["Whatsapp_1_Date"];
    if (dateField) { const d = new Date(dateField); if (!isNaN(d.getTime())) return d; }
    return null;
};

const getOwnerLatestActivity = (o: any) => {
    // Start from the WA send date (extracted from message text) or createdOn
    const waDate = extractOwnerWADate(o);
    let latest = waDate || (o.createdOn ? new Date(o.createdOn) : new Date(0));
    
    // Check WTS_Reply_Track for timestamp
    if (o.WTS_Reply_Track) {
        const { date } = parseMsg(o.WTS_Reply_Track);
        if (date && date > latest) latest = date;
    }
    
    // Check Bot_Replied_X and User_Replied_X
    for (let i = 1; i <= 10; i++) {
        const br = o[`Bot_Replied_${i}`];
        if (br) {
            const { date } = parseMsg(br);
            if (date && date > latest) latest = date;
        }
        const ur = o[`User_Replied_${i}`];
        if (ur) {
            const { date } = parseMsg(ur);
            if (date && date > latest) latest = date;
        }
    }
    
    return latest;
};

// Fetch WA-specific data from the dedicated endpoint (filters by WA TS columns, not Created At)
async function fetchWALeadsData(from: Date, to: Date): Promise<{ nr_wf: any[]; followup: any[]; nurture: any[]; owners: any[] }> {
    const { startOfDay, endOfDay } = await import("date-fns");
    const fromISO = startOfDay(from).toISOString();
    const toISO = endOfDay(to).toISOString();
    const res = await fetch(`/api/whatsapp-leads?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export default function WhatsappChatPage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [waOwners, setWaOwners] = useState<any[]>([]);
    const [loadingWA, setLoadingWA] = useState(true);
    const loading = loadingWA;
    const [searchQuery, setSearchQuery] = useState("");
    // Store the full lead object so WhatsAppChatDetail gets it via initialLead
    // (it would otherwise search DataContext.allLeads which doesn't contain WA-page leads)
    const [selectedLeadObj, setSelectedLeadObj] = useState<any | null>(null);
    const getStandardTemplates = (loops: string[]) => {
        const result: any[] = [];
        if (loops.includes("Intro")) {
            for (let i = 1; i <= 4; i++) {
                const day = (i - 1) * 2;
                result.push({ 
                    id: `intro-${i}`, 
                    name: `Cold Message #${i} (Day ${day})`, 
                    column: `W.P_${i}`,
                    category: 'Intro Loop'
                });
            }
        }
        if (loops.includes("Follow Up")) {
            for (let i = 1; i <= 10; i++) {
                result.push({ 
                    id: `followup-${i}`, 
                    name: `Follow-Up Message #${i}`, 
                    column: `W.P_FollowUp_${i}`,
                    category: 'Follow-Up Loop'
                });
            }
        }
        if (loops.includes("Nurture")) {
            for (let i = 1; i <= 6; i++) {
                result.push({ 
                    id: `nurture-wp-${i}`, 
                    name: `Nurture Message #${i}`, 
                    column: `W.P_${i}`,
                    category: 'Nurture Loop'
                });
            }
            for (let i = 1; i <= 10; i++) {
                result.push({ 
                    id: `nurture-fu-${i}`, 
                    name: `Nurture Message #${i + 6}`, 
                    column: `W.P_FollowUp_${i}`,
                    category: 'Nurture Loop'
                });
            }
        }
        return result;
    };

    const [dateRange, setDateRange] = useState<any>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });

    // Re-fetch from the WA-specific endpoint when date range changes.
    // This filters by "W.P_1 TS" (nr_wf), "W.P_1  TS" (followup), and "Whatsapp_1_Date" (owners)
    // so the list is correct regardless of "Created At".
    useEffect(() => {
        if (!dateRange?.from) return;
        setLoadingWA(true);
        fetchWALeadsData(dateRange.from, dateRange.to || dateRange.from)
            .then(data => {
                const nr_wf = (data.nr_wf || []).map((l: any) => ({ ...l, source_loop: "Intro" }));
                const followup = (data.followup || []).map((l: any) => ({ ...l, source_loop: "Follow Up" }));
                const nurture = (data.nurture || []).map((l: any) => ({ ...l, source_loop: "Nurture" }));
                setLeads([...nr_wf, ...followup, ...nurture]);
                setWaOwners(data.owners || []);
            })
            .catch(err => console.error("[WA chat]", err))
            .finally(() => setLoadingWA(false));
    }, [dateRange]);

    const [currentPage, setCurrentPage] = useState(1);
    const leadsPerPage = 10;

    // Tab state: "leads" or "owners"
    const [activeTab, setActiveTab] = useState<"leads">("leads");

    // URL Sync for chat
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const initialSelectedId = searchParams?.get('chat');
    const initialTab = searchParams?.get('tab');

    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(initialSelectedId || null);
    const initialProcessed = useRef(false);

    useEffect(() => {
        const url = new URL(window.location.origin + window.location.pathname);
        if (selectedLeadId) {
            url.searchParams.set('chat', selectedLeadId);
            url.searchParams.set('tab', 'leads');
        } else {
            url.searchParams.delete('chat');
            url.searchParams.delete('tab');
        }
        window.history.replaceState({}, '', url.toString());
    }, [selectedLeadId]);

    // Handle initial URL parameters
    useEffect(() => {
        if (initialProcessed.current) return;
        
        if (initialSelectedId) {
            setSelectedLeadId(initialSelectedId);
            initialProcessed.current = true;
        } else {
            initialProcessed.current = true;
        }
    }, [initialSelectedId]);

    // Filter State
    const [pendingFilters, setPendingFilters] = useState<{
        replyStatus: string[],
        loops: string[],
        messageStatus: string[],
        templates: string[]
    }>({
        replyStatus: [],
        loops: [],
        messageStatus: [],
        templates: []
    });

    const [activeFilters, setActiveFilters] = useState<{
        replyStatus: string[],
        loops: string[],
        messageStatus: string[],
        templates: string[]
    }>({
        replyStatus: [],
        loops: [],
        messageStatus: [],
        templates: []
    });


    // leadsInRange = only leads where W.P_1 was sent within the selected date range.
    const leadsInRange = useMemo(() => {
        const from = dateRange?.from ? startOfDay(new Date(dateRange.from)).getTime() : null;
        const to = endOfDay(new Date(dateRange?.to || dateRange?.from || new Date())).getTime();
        return leads.filter(lead => {
            if (!lead["W.P_1"]) return false;
            if (!lead.wp1_parsed_date) return true; // no date info — include
            const t = new Date(lead.wp1_parsed_date).getTime();
            return !from || (t >= from && t <= to);
        });
    }, [leads, dateRange]);

    const filteredLeads = useMemo(() => {
        return leadsInRange.filter(l => {
            const lead = l as any;
            // WA endpoint returns "Name" / "Phone" (uppercase keys from DB columns)
            const name = String(lead["Name"] || lead.name || "").toLowerCase();
            const phone = String(lead["Phone"] || lead.phone || "");
            const matchesSearch = name.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);

            const wtReplied = lead["WP_Replied_track"] || lead.WP_Replied_track;
            let hasReplied = false;
            if (wtReplied && String(wtReplied).trim() !== "") {
                const s = String(wtReplied).trim().toLowerCase();
                if (s !== "no" && s !== "none") hasReplied = true;
            }

            const matchesReplyStatus = activeFilters.replyStatus.length === 0 ||
                (activeFilters.replyStatus.includes("Replied") && hasReplied) ||
                (activeFilters.replyStatus.includes("No Reply") && !hasReplied);

            const matchesLoop = activeFilters.loops.length === 0 ||
                activeFilters.loops.some(loop => {
                    const lName = (lead.source_loop || "").toLowerCase();
                    const target = loop.toLowerCase();
                    if (target === "follow up") return lName.includes("follow up") || lName.includes("followup");
                    return lName.includes(target);
                });

            const matchesMessageStatus = activeFilters.messageStatus.length === 0 ||
                activeFilters.messageStatus.some(status => {
                    const target = status.toLowerCase();
                    for (let i = 1; i <= 12; i++) {
                        const s = (lead[`W.P_${i} TS`] || "").toLowerCase();
                        if (s.includes(target)) return true;
                    }
                    return false;
                });

            const matchesTemplate = activeFilters.templates.length === 0 ||
                activeFilters.templates.some(tName => {
                    const match = tName.match(/Message\s*#?\s*(\d+)/i);
                    const index = match ? parseInt(match[1]) : null;
                    if (!index) return false;

                    const isIntro = tName.toLowerCase().includes("cold") || tName.toLowerCase().includes("intro");
                    const isFollowUp = tName.toLowerCase().includes("follow-up") || tName.toLowerCase().includes("followup");
                    const isNurture = tName.toLowerCase().includes("nurture");

                    if (isIntro) {
                        return !!lead[`W.P_${index}`];
                    }
                    if (isFollowUp) {
                        return !!lead[`W.P_FollowUp ${index}`] || !!lead[`W.P_FollowUp_${index}`];
                    }
                    if (isNurture) {
                        const inWP = index <= 6 && (!!lead[`W.P_${index}`] || !!lead.stage_data?.[`WhatsApp ${index}`]);
                        const inFollowUp = index <= 10 && (!!lead[`W.P_FollowUp_${index}`] || (index === 1 && !!lead[`W.P_FollowUp`]));
                        return inWP || inFollowUp;
                    }
                    return false;
                });

            return matchesSearch && matchesReplyStatus && matchesLoop && matchesMessageStatus && matchesTemplate;
        }).sort((a, b) => {
            // Sort by latest_wp_date from server (most recent in-range message date).
            // Falls back to wp1_parsed_date then Created At.
            const getDate = (l: any) => {
                const raw = l.latest_wp_date || l.wp1_parsed_date || l["Created At"] || l.created_at;
                return raw ? new Date(raw).getTime() : 0;
            };
            return getDate(b) - getDate(a);
        });
    }, [leads, searchQuery, activeFilters, dateRange]);

    // Owner filtering — waOwners already pre-filtered by Whatsapp_1_Date on the server
    const filteredOwners = useMemo(() => {
        return waOwners.filter(o => {
            const name = String(o.Name || o.name || "").toLowerCase();
            const phone = String(o.contactNo || o.Phone || o.phone || "");
            const matchesSearch = name.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery);
            if (!matchesSearch) return false;

            // Reply Status Filter
            if (activeFilters.replyStatus.length > 0) {
                const wtsReply = o["WTS_Reply_Track"];
                const hasReplied = wtsReply && wtsReply !== "" && String(wtsReply).toLowerCase() !== "no";
                const matchesReply = (activeFilters.replyStatus.includes("Replied") && hasReplied) ||
                                     (activeFilters.replyStatus.includes("No Reply") && !hasReplied);
                if (!matchesReply) return false;
            }

            // Message Status Filter (e.g. Read, Delivered, Sent, Failed)
            if (activeFilters.messageStatus.length > 0) {
                const status = (o["Whatsapp_1_status"] || "").toLowerCase();
                const matchesStatus = activeFilters.messageStatus.some(s => status.includes(s.toLowerCase()));
                if (!matchesStatus) return false;
            }

            // Template Filter
            if (activeFilters.templates.length > 0) {
                const matchesTemplate = activeFilters.templates.some(tName => {
                    const match = tName.match(/Message\s*#?\s*(\d+)/i);
                    const index = match ? parseInt(match[1]) : null;
                    if (!index) return false;

                    const isIntro = tName.toLowerCase().includes("cold") || tName.toLowerCase().includes("intro") || tName.toLowerCase().includes("owner");
                    const isFollowUp = tName.toLowerCase().includes("follow-up") || tName.toLowerCase().includes("followup");
                    const isNurture = tName.toLowerCase().includes("nurture");

                    if (isIntro) return !!o[`Whatsapp_${index}`];
                    if (isFollowUp) return !!o[`Bot_Replied_${index}`];
                    if (isNurture) {
                        return (index <= 6 && !!o[`Whatsapp_${index}`]) || (index <= 10 && !!o[`Bot_Replied_${index}`]);
                    }
                    return false;
                });
                if (!matchesTemplate) return false;
            }

            return true;
        }).sort((a, b) => {
            const dateA = getOwnerLatestActivity(a);
            const dateB = getOwnerLatestActivity(b);
            return dateB.getTime() - dateA.getTime();
        });
    }, [waOwners, searchQuery, activeFilters]);

    // --- Stats ---
    // Chat list + Unique Msg Sent = leadsInRange (W.P_1 sent in selected date range).
    // Messages Sent = total filled WP message slots across all in-range leads.
    // Total Replies = leads in filteredLeads (after search/filter) with a reply tracked.
    const stats = useMemo(() => {
        let sentCount = 0;
        let repliedCount = 0;
        let failedCount = 0;
        let uniqueSentCount = 0;

        if (activeTab === "leads") {
            // uniqueSentCount = filteredLeads length (already filtered to in-range W.P_1 leads)
            uniqueSentCount = filteredLeads.length;

            filteredLeads.forEach(l => {
                const lead = l as any;

                // Messages Sent: all filled WP slots on this lead
                for (let i = 1; i <= 12; i++) {
                    if (lead[`W.P_${i}`]) {
                        sentCount++;
                        const ts = lead[`W.P_${i} TS`];
                        if (ts && String(ts).toLowerCase().includes("failed")) failedCount++;
                    }
                }
                if (lead["W.P_FollowUp"]) sentCount++;
                for (let i = 1; i <= 10; i++) {
                    if (lead[`W.P_FollowUp_${i}`] || lead[`W.P_FollowUp ${i}`]) sentCount++;
                }

                // Replied
                const rt = lead.WP_Replied_track || lead["WP_Replied_track"];
                if (rt && String(rt).trim() && String(rt).trim().toLowerCase() !== "no" && String(rt).trim().toLowerCase() !== "none") {
                    repliedCount++;
                }
            });
        } else {
            // Owner Stats — owners are already filtered by Whatsapp_1_Date in range
            filteredOwners.forEach(o => {
                if (o["Whatsapp_1"]) { sentCount++; uniqueSentCount++; }
                if (o["retry_1"]) sentCount++;
                for (let i = 1; i <= 5; i++) { if (o[`Bot_Replied_${i}`]) sentCount++; }
                if (o["Whatsapp_1_status"]?.toLowerCase().includes("failed")) failedCount++;
                const wtsReply = o["WTS_Reply_Track"];
                if (wtsReply && wtsReply !== "" && String(wtsReply).toLowerCase() !== "no") repliedCount++;
            });
        }

        const responseRate = uniqueSentCount > 0 ? ((repliedCount / uniqueSentCount) * 100).toFixed(1) : "0.0";

        return {
            totalLeads: activeTab === "leads" ? filteredLeads.length : filteredOwners.length,
            sentCount,
            uniqueSentCount,
            repliedCount,
            failedCount,
            responseRate,
        };
    }, [filteredLeads, filteredOwners, activeTab, dateRange]);

    const handleApplyFilters = () => { setActiveFilters(pendingFilters); };
    const handleResetFilters = () => {
        const reset = { replyStatus: [], loops: [], messageStatus: [], templates: [] };
        setPendingFilters(reset);
        setActiveFilters(reset);
    };

    const toggleFilter = (type: 'replyStatus' | 'loops' | 'messageStatus' | 'templates', value: string) => {
        setPendingFilters(prev => {
            const current = prev[type];
            if (current.includes(value)) {
                return { ...prev, [type]: current.filter(v => v !== value) };
            } else {
                return { ...prev, [type]: [...current, value] };
            }
        });
    };

    const paginatedLeads = useMemo(() => {
        const start = (currentPage - 1) * leadsPerPage;
        return filteredLeads.slice(start, start + leadsPerPage);
    }, [filteredLeads, currentPage]);

    const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);

    useEffect(() => { setCurrentPage(1); }, [searchQuery, activeFilters, dateRange]);

    const renderPaginationItems = () => {
        const items = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
            for (let i = 1; i <= totalPages; i++) {
                items.push(renderPageButton(i));
            }
        } else {
            items.push(renderPageButton(1));

            if (currentPage > 3) {
                items.push(<span key="dots-1" className="flex items-center justify-center w-8 h-8 text-[var(--label-tertiary)]"><MoreHorizontal className="h-4 w-4" /></span>);
            }

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                if (i > 1 && i < totalPages) {
                    items.push(renderPageButton(i));
                }
            }

            if (currentPage < totalPages - 2) {
                items.push(<span key="dots-2" className="flex items-center justify-center w-8 h-8 text-[var(--label-tertiary)]"><MoreHorizontal className="h-4 w-4" /></span>);
            }

            items.push(renderPageButton(totalPages));
        }
        return items;
    };

    const renderPageButton = (page: number) => (
        <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            className={`h-8 w-8 text-xs font-bold ${currentPage === page ? 'bg-slate-900 text-white' : 'text-[var(--label-secondary)]'
                }`}
            onClick={() => setCurrentPage(page)}
        >
            {page}
        </Button>
    );



    const paginatedOwners = filteredOwners.slice((currentPage - 1) * leadsPerPage, currentPage * leadsPerPage);

    return (
        <div className="space-y-6 pb-10 relative min-h-[500px]">
            {loading && <LMLoader />}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--label-primary)]">WhatsApp Chats</h1>
                    <p className="text-[var(--label-secondary)] text-sm">Real-time engagement across your leads</p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {/* Tab Switcher */}
                    <div className="flex bg-[var(--fill-quaternary)] rounded-lg p-0.5">
                        <button
                            onClick={() => { setActiveTab("leads"); setCurrentPage(1); }}
                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === "leads" ? "bg-[var(--glass-fill)] text-[var(--label-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)]" : "text-[var(--label-secondary)] hover:text-[var(--label-primary)]"}`}
                        >
                            <Users className="h-3.5 w-3.5 inline mr-1.5" />Leads
                        </button>
                    </div>
                    <DateRangePicker onUpdate={(values) => setDateRange(values.range)} />
                    <Button variant="outline" size="sm" onClick={() => { window.location.reload(); }} className="gap-2 h-9">
                        <RefreshCw className="h-4 w-4" /> Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)] h-auto">
                        <CardContent className="p-4 space-y-6">
                            <div className="flex items-center justify-between border-b border-[var(--separator)] pb-2">
                                <div className="flex items-center gap-2 text-[var(--label-primary)] font-bold">
                                    <Filter className="h-4 w-4" /> Filters
                                </div>
                                {(activeFilters.replyStatus.length > 0 || activeFilters.loops.length > 0 || activeFilters.messageStatus.length > 0 || activeFilters.templates.length > 0) && (
                                    <button onClick={handleResetFilters} className="text-[10px] text-emerald-600 font-bold hover:underline">RESET</button>
                                )}
                            </div>

                            <FilterSection title="Reply Status" >
                                <FilterOption label="Replied" checked={pendingFilters.replyStatus.includes("Replied")} onCheckedChange={() => toggleFilter('replyStatus', "Replied")} />
                                <FilterOption label="No Reply" checked={pendingFilters.replyStatus.includes("No Reply")} onCheckedChange={() => toggleFilter('replyStatus', "No Reply")} />
                            </FilterSection>

                            {activeTab === "leads" && (
                                <FilterSection title="Loop">
                                    <FilterOption label="Intro" checked={pendingFilters.loops.includes("Intro")} onCheckedChange={() => toggleFilter('loops', "Intro")} />
                                    <FilterOption label="Follow Up" checked={pendingFilters.loops.includes("Follow Up")} onCheckedChange={() => toggleFilter('loops', "Follow Up")} />
                                    <FilterOption label="Nurture" checked={pendingFilters.loops.includes("Nurture")} onCheckedChange={() => toggleFilter('loops', "Nurture")} />
                                </FilterSection>
                            )}

                            {pendingFilters.loops.length > 0 && (
                                <FilterSection title="Templates">
                                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                        {getStandardTemplates(pendingFilters.loops).map(t => (
                                            <FilterOption 
                                                key={t.id} 
                                                id={t.id}
                                                label={
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold">{t.name}</span>
                                                        <span className="text-[9px] text-[var(--label-tertiary)] font-mono uppercase">[{t.column}]</span>
                                                    </div>
                                                } 
                                                checked={pendingFilters.templates.includes(t.name)} 
                                                onCheckedChange={() => toggleFilter('templates', t.name)} 
                                            />
                                        ))}
                                    </div>
                                </FilterSection>
                            )}

                            <FilterSection title="Message Status">
                                <FilterOption label="Read" checked={pendingFilters.messageStatus.includes("Read")} onCheckedChange={() => toggleFilter('messageStatus', "Read")} />
                                <FilterOption label="Sent" checked={pendingFilters.messageStatus.includes("Sent")} onCheckedChange={() => toggleFilter('messageStatus', "Sent")} />
                                <FilterOption label="Failed" checked={pendingFilters.messageStatus.includes("Failed")} onCheckedChange={() => toggleFilter('messageStatus', "Failed")} />
                                <FilterOption label="Delivered" checked={pendingFilters.messageStatus.includes("Delivered")} onCheckedChange={() => toggleFilter('messageStatus', "Delivered")} />
                                <FilterOption label="Deleted" checked={pendingFilters.messageStatus.includes("Deleted")} onCheckedChange={() => toggleFilter('messageStatus', "Deleted")} />
                            </FilterSection>

                            <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white h-9" size="sm" onClick={handleApplyFilters}>Apply Filters</Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-3 space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <MetricCard title="Messages Sent" value={loading ? "..." : stats.sentCount.toLocaleString()} desc="Total outgoing pulses" icon={Send} />
                            <MetricCard title="Unique Msg Sent" value={loading ? "..." : stats.uniqueSentCount.toLocaleString()} desc="Unique entities contacted" icon={Users} />
                            <MetricCard title="Total Replies" value={loading ? "..." : stats.repliedCount.toLocaleString()} desc={`${stats.responseRate}% Response Rate`} icon={MessageSquare} />
                        </div>
                        <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)]">
                            <CardContent className="p-4 space-y-4">
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--label-primary)]">Delivery Status</h3>
                                    <p className="text-xs text-[var(--label-secondary)]">Global outbound health</p>
                                </div>
                                <div className="space-y-3">
                                    <StatusBar label="Sent" value={stats.sentCount} total={stats.sentCount || 1} color="bg-blue-400" />
                                    <StatusBar label="Replied" value={stats.repliedCount} total={stats.uniqueSentCount || 1} color="bg-[rgba(52,199,89,0.08)]0" />
                                    {stats.failedCount > 0 && (
                                        <StatusBar label="Failed" value={stats.failedCount} total={stats.sentCount || 1} color="bg-rose-500" />
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--label-tertiary)]" />
                        <Input className="pl-10 bg-[var(--glass-fill)]" placeholder={`Search ${activeTab} by name or phone...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>

                    <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)] overflow-hidden">
                        {loading ? (
                            <div className="p-10 text-center text-[var(--label-secondary)] flex flex-col items-center gap-2">
                                <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
                                Loading real-time chats...
                            </div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="p-10 text-center text-[var(--label-secondary)]">No WhatsApp chats found.</div>
                        ) : (
                            <TooltipProvider>
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-[var(--bg-app)] text-[var(--label-secondary)] font-bold border-b border-[var(--separator)]">
                                        <tr>
                                            <th className="px-4 py-3">Lead</th>
                                            <th className="px-4 py-3 text-center">Loop</th>
                                            <th className="px-4 py-3 text-center">Messages Sent</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-4 py-3 text-center">Message Status</th>
                                            <th className="px-4 py-3 text-right">Last Contacted</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--separator)]">
                                        {paginatedLeads.map((lead, idx) => {
                                            const leadId = lead["Lead ID"] || lead.id || String(idx);
                                            return (
                                                <CustomerRow key={`${leadId}-${idx}`} lead={lead} onClick={() => {
                                                    // Normalize DB-column-cased keys to the shape WhatsAppChatDetail expects
                                                    setSelectedLeadObj({
                                                        ...lead,
                                                        id: leadId,
                                                        name: lead["Name"] || lead.name || "",
                                                        phone: lead["Phone"] || lead.phone || "",
                                                        email: lead["Email"] || lead.email || "",
                                                        source_loop: lead.source_loop,
                                                    });
                                                    setSelectedLeadId(leadId);
                                                }} />
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </TooltipProvider>
                        )}

                        {totalPages > 1 && (
                            <div className="bg-[var(--bg-app)] border-t border-[var(--separator)] px-4 py-3 flex items-center justify-between">
                                <div className="text-xs text-[var(--label-secondary)] font-medium">
                                    Showing <span className="text-[var(--label-primary)] font-bold">{(currentPage - 1) * leadsPerPage + 1}</span> to <span className="text-[var(--label-primary)] font-bold">{Math.min(currentPage * leadsPerPage, filteredLeads.length)}</span> of <span className="text-[var(--label-primary)] font-bold">{filteredLeads.length}</span> leads
                                </div>
                                <div className="flex gap-1 items-center">
                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div className="flex gap-1">
                                        {renderPaginationItems()}
                                    </div>
                                    <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Lead Chat Dialog */}
            <Dialog open={!!selectedLeadId} onOpenChange={(open) => { if (!open) { setSelectedLeadId(null); setSelectedLeadObj(null); } }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-6 gap-0">
                    <DialogHeader className="sr-only"><DialogTitle>WhatsApp Chat Detail</DialogTitle></DialogHeader>
                    {selectedLeadId && (
                        <WhatsAppChatDetail
                            customerId={selectedLeadId}
                            initialLead={selectedLeadObj}
                            onClose={() => { setSelectedLeadId(null); setSelectedLeadObj(null); }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function MetricCard({ title, value, desc, icon: Icon, dots }: any) {
    return (
        <Card className="bg-[var(--glass-fill)] border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)]">
            <CardContent className="p-4">
                <div className="p-2 bg-[rgba(52,199,89,0.08)] text-emerald-600 rounded-lg w-fit mb-2"><Icon className="h-5 w-5" /></div>
                <h3 className="text-2xl font-bold text-[var(--label-primary)]">{value}</h3>
                <p className="text-xs font-medium text-[var(--label-secondary)]">{title}</p>
                <p className="text-[10px] text-[var(--label-tertiary)] mt-1">{desc}</p>
                {dots && (
                    <div className="flex gap-1 mt-2">
                        <div className="h-2 w-2 rounded-full bg-blue-400" /><div className="h-2 w-2 rounded-full bg-[rgba(52,199,89,0.08)]0" /><div className="h-2 w-2 rounded-full bg-rose-500" />
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StatusBar({ label, value, total, color }: any) {
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-medium text-[var(--label-secondary)]">
                <span>{label}</span><span>{value} ({((value / total) * 100).toFixed(1)}%)</span>
            </div>
            <div className="h-1.5 w-full bg-[var(--fill-quaternary)] rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${(value / total) * 100}%` }} />
            </div>
        </div>
    );
}

function FilterSection({ title, children }: any) {
    return (
        <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase text-[var(--label-tertiary)]">{title}</h4>
            <div className="space-y-1.5">{children}</div>
        </div>
    );
}

function FilterOption({ id, label, checked, onCheckedChange }: any) {
    const finalId = id || (typeof label === 'string' ? label : Math.random().toString());
    return (
        <div className="flex items-center gap-2">
            <Checkbox id={finalId} className="h-3.5 w-3.5 border-[var(--separator)]" checked={checked} onCheckedChange={onCheckedChange} />
            <label htmlFor={finalId} className="text-sm font-medium text-[var(--label-secondary)] cursor-pointer flex-1">{label}</label>
        </div>
    );
}

function CustomerRow({ lead: leadRaw, onClick }: { lead: any; onClick: () => void }) {
    const lead = leadRaw as any;
    // latest_wp_date = most recent WP message date that falls within the selected range
    // (computed by the RPC in migration 006). Falls back to wp1_parsed_date then Created At.
    const latestWpRaw = lead.latest_wp_date || lead.wp1_parsed_date;
    const createdRaw = lead["Created At"] || lead.created_at;
    const latestDate = latestWpRaw ? new Date(latestWpRaw) : (createdRaw ? new Date(createdRaw) : new Date(0));
    // WA endpoint returns "Name"/"Phone" (DB column case); fallback to lowercase for consolidated leads
    const displayName = lead["Name"] || lead.name || "—";
    const displayPhone = lead["Phone"] || lead.phone || "—";

    let sentCount = 0;
    for (let i = 1; i <= 12; i++) { if (lead[`W.P_${i}`]) sentCount++; }
    // "W.P_FollowUp" aliased from "W.P_FollowUp 1" by the RPC
    if (lead["W.P_FollowUp"]) sentCount++;
    for (let i = 1; i <= 10; i++) { if (lead[`W.P_FollowUp ${i}`] || lead[`W.P_FollowUp_${i}`]) sentCount++; }

    // Collect all available statuses
    const allStatuses = [];
    for (let i = 1; i <= 12; i++) {
        if (lead[`W.P_${i} TS`]) {
            allStatuses.push({ index: i, status: lead[`W.P_${i} TS`] });
        }
    }
    // Just show the last 2 to keep UI clean, in chronological order
    const displayStatuses = allStatuses.slice(-2);

    const wtRepliedTrack = lead["WP_Replied_track"] || lead.WP_Replied_track;
    let hasReplied = false;
    if (wtRepliedTrack && String(wtRepliedTrack).trim() !== "") {
        const s = String(wtRepliedTrack).trim().toLowerCase();
        if (s !== "no" && s !== "none") hasReplied = true;
    }

    const formatTooltipDate = (date: Date | string) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(d.getTime())) return String(date);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleString([], { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <tr className="hover:bg-[var(--bg-app)] transition-colors cursor-pointer group" onClick={onClick}>
            <td className="px-4 py-3">
                <div className="block">
                    <div className="font-bold text-[var(--label-primary)] group-hover:text-emerald-700">{displayName}</div>
                    <div className="text-xs text-[var(--label-secondary)]">{displayPhone}</div>
                </div>
            </td>
            <td className="px-4 py-3 text-center">
                <Badge variant="outline" className="text-[10px] uppercase font-bold border-blue-100 text-blue-600 bg-[rgba(0,122,255,0.08)]">{lead.source_loop}</Badge>
            </td>
            <td className="px-4 py-3 text-center font-bold text-[var(--label-primary)]">{sentCount}</td>
            <td className="px-4 py-3 text-center">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                {hasReplied ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold">REPLIED</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] text-[var(--label-tertiary)] border-[var(--separator)]">SENT</Badge>
                                )}
                            </div>
                        </TooltipTrigger>
                        {hasReplied && (
                            <TooltipContent side="top" className="bg-slate-800/40 backdrop-blur-md text-white text-[10px] border-none px-2 py-1 shadow-xl">
                                {formatTooltipDate(latestDate)}
                            </TooltipContent>
                        )}
                    </Tooltip>
                </TooltipProvider>
            </td>
            <td className="px-4 py-3 text-center">
                <div className="flex flex-col items-center gap-1.5">
                    {displayStatuses.map((s) => (
                        <MessageStatusBadge key={s.index} index={s.index} status={s.status} />
                    ))}
                    {displayStatuses.length === 0 && <span className="text-[var(--label-tertiary)] text-[10px]">—</span>}
                </div>
            </td>
            <td className="px-4 py-3 text-right text-[var(--label-secondary)] text-xs text-nowrap">
                {latestDate.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
            </td>
        </tr>
    );
}

function MessageStatusBadge({ index, status }: { index: number, status: string }) {
    if (!status) return null;
    const parts = status.split(' - ');
    const statusText = parts[0].trim();
    // If there's no " - ", the entire status string might be the timestamp
    const rawTimestamp = parts.length > 1 ? parts[1].trim() : status.trim();

    const formatTooltipDate = (dateStr: string) => {
        const d = new Date(dateStr.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/, '$3-$2-$1'));
        const finalDate = isNaN(d.getTime()) ? new Date(dateStr) : d;
        if (isNaN(finalDate.getTime())) return dateStr;
        const now = new Date();
        if (finalDate.toDateString() === now.toDateString()) return finalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return finalDate.toLocaleString([], { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const formatted = statusText.charAt(0).toUpperCase() + statusText.slice(1).toLowerCase();
    let badgeClass = "bg-[var(--fill-quaternary)] text-[var(--label-secondary)] border-[var(--separator)]";
    if (formatted.includes("Delivered")) badgeClass = "bg-[rgba(52,199,89,0.08)] text-emerald-700 border-emerald-100";
    if (formatted.includes("Read")) badgeClass = "bg-[rgba(0,122,255,0.08)] text-blue-700 border-blue-100";
    if (formatted.includes("Failed")) badgeClass = "bg-red-50 text-red-700 border-red-100";

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 w-full justify-center cursor-help">
                        <span className="text-[9px] text-[var(--label-tertiary)] font-mono select-none">{index}</span>
                        <Badge variant="outline" className={`h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider ${badgeClass}`}>{formatted}</Badge>
                    </div>
                </TooltipTrigger>
                {rawTimestamp && (
                    <TooltipContent side="top" className="bg-slate-800/40 backdrop-blur-md text-white text-[10px] border-none px-2 py-1 shadow-xl">{formatTooltipDate(rawTimestamp)}</TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    );
}

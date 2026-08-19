"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    Download,
    MessageSquare,
    User,
    Bot,
    Link as LinkIcon,
    Check
} from "lucide-react";
import { ConsolidatedLead } from "@/lib/leads-utils";
import { useData } from "@/context/DataContext";

function parseActivityContent(content: string, summary?: string): any[] {
    if (!content) return [];
    const messages: any[] = [];
    const lines = content.split('\n');
    let seq = 0;
    let lastMessageKey = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Template message — first message
        if (line.startsWith('Template: ')) {
            const text = line.substring('Template: '.length).trim();
            const msg = {
                type: 'bot' as const,
                content: text,
                label: 'Agent',
                date: null as string | null,
                sequence: ++seq,
            };
            messages.push(msg);
            lastMessageKey = 'bot';
            continue;
        }

        // User message
        if (line.startsWith('User: ')) {
            const text = line.substring('User: '.length).trim();
            const key = `user:${text}`;
            // Skip duplicate consecutive user messages
            if (key === lastMessageKey) continue;
            const msg = {
                type: 'user' as const,
                content: text,
                label: 'User',
                date: null as string | null,
                sequence: ++seq,
            };
            messages.push(msg);
            lastMessageKey = key;
            continue;
        }

        // Agent message
        if (line.startsWith('Agent : ') || line.startsWith('Agent: ')) {
            const text = line.replace(/^Agent\s*:\s*/, '').trim();
            const msg = {
                type: 'bot' as const,
                content: text,
                label: 'Agent',
                date: null as string | null,
                sequence: ++seq,
            };
            messages.push(msg);
            lastMessageKey = `bot:${text}`;
            continue;
        }

        // Timestamp line — attach to previous message
        const tsMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4}),\s*(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))/i);
        if (tsMatch) {
            const dateStr = `${tsMatch[1]} ${tsMatch[2]}`;
            // Convert "07/07/2026 01:04:49 PM" to ISO
            const [m, d, y] = dateStr.split(/[\/\s,]+/);
            const timeStr = dateStr.match(/\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)/i)?.[0] || '';
            const parsed = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${timeStr}`);
            if (!isNaN(parsed.getTime()) && messages.length > 0) {
                messages[messages.length - 1].date = parsed.toISOString();
            }
            continue;
        }

        // Continuation of previous message content
        if (messages.length > 0) {
            messages[messages.length - 1].content += '\n' + line;
        }
    }

    return messages;
}

interface WhatsAppChatDetailProps {
    customerId: string;
    onClose?: () => void;
    initialLead?: ConsolidatedLead;
}

const EMPTY_LEADS: any[] = [];
const EMPTY_MESSAGES: any[] = [];

export function WhatsAppChatDetail({ customerId, onClose, initialLead }: WhatsAppChatDetailProps) {
    let dataContext: any = {};
    try {
        dataContext = useData();
    } catch (e) {
        // Fallback for public view without DataProvider
    }
    const { leads: allLeads = EMPTY_LEADS, loadingLeads = false } = dataContext;
    const [lead, setLead] = useState<ConsolidatedLead | null>(initialLead || null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<any[]>([]);
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
        if (!lead) return;
        const baseUrl = window.location.origin;
        // Use lead_phone (activity column) → phone → customerId as share identifier
        const rawPhone = (lead as any).lead_phone || lead.phone || (lead as any)["Phone"] || customerId;
        const cleanPhone = String(rawPhone).replace(/\s/g, '');  // keep + and digits, strip spaces only
        const shareId = cleanPhone || customerId;
        const shareUrl = `${baseUrl}/share/whatsapp/${encodeURIComponent(shareId)}`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }).catch(err => {
                console.error("Failed to copy link:", err);
            });
        } else {
            const textArea = document.createElement("textarea");
            textArea.value = shareUrl;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } catch (err) {
                console.error("Fallback copy failed:", err);
            }
            document.body.removeChild(textArea);
        }
    };

    useEffect(() => {
        let isMounted = true;

        async function loadLeadData() {
            if (!initialLead && loadingLeads) {
                setLoading(true);
                return;
            }

            setLoading(true);
            const searchVal = String(customerId).toLowerCase().trim();
            let found = initialLead || allLeads.find((l: { id: any; phone: any; }) => {
                if (String(l.id).toLowerCase() === searchVal) return true;
                if (l.phone) {
                    const lPhoneReplaced = String(l.phone).replace(/\D/g, '');
                    const searchReplaced = searchVal.replace(/\D/g, '');
                    if (searchReplaced && lPhoneReplaced === searchReplaced) return true;
                }
                return false;
            }) || null;

            // Fallback for public share links or leads not present in memory
            if (!found) {
                try {
                    // Try fetching activity logs first
                    const actRes = await fetch(`/api/activity?channel=WhatsApp&search=${encodeURIComponent(customerId)}`);
                    let actLogs: any[] = [];
                    if (actRes.ok) {
                        const actData = await actRes.json();
                        actLogs = actData.activities || [];
                    }

                    // Try fetching whatsapp leads list
                    const leadsRes = await fetch(`/api/whatsapp-leads`);
                    if (leadsRes.ok) {
                        const data = await leadsRes.json();
                        const nr_wf = data.nr_wf || [];
                        const followup = data.followup || [];
                        const nurture = data.nurture || [];
                        const owners = data.owners || [];
                        const wa_activity = data.wa_activity || [];
                        const allFetched = [...nr_wf, ...followup, ...nurture, ...owners, ...wa_activity];

                        found = allFetched.find((l: any) => {
                            if (String(l.id || l["Lead ID"]).toLowerCase() === searchVal) return true;
                            if (l.phone || l.Phone || l.lead_phone) {
                                const lPhoneReplaced = String(l.phone || l.Phone || l.lead_phone).replace(/\D/g, '');
                                const searchReplaced = searchVal.replace(/\D/g, '');
                                if (searchReplaced && lPhoneReplaced === searchReplaced) return true;
                            }
                            return false;
                        }) || null;
                    }

                    if (!found && actLogs.length > 0) {
                        const first = actLogs[0];
                        found = {
                            id: first.lead_id || customerId,
                            name: first.lead_name || "WhatsApp Contact",
                            phone: first.lead_phone || customerId,
                            email: first.lead_email || "",
                            source_loop: first.campaign || first.source_loop || "WhatsApp",
                            status: first.status || "delivered",
                            content: first.content,
                            summary: first.summary
                        } as any;
                    }

                    if (!found) {
                        found = {
                            id: customerId,
                            name: customerId,
                            phone: customerId,
                            source_loop: "WhatsApp"
                        } as any;
                    }
                } catch (e) {
                    console.error("Error fetching WhatsApp lead:", e);
                }
            }

            if (!isMounted) return;

            if (found) {
                // Normalize raw API leads (have "Name", "Phone", "source_loop") into ConsolidatedLead shape
                const rawName = (found as any).name || (found as any)["Name"] || "";
                const isPhoneNumber = /^\+?\d[\d\s\-().]{4,}$/.test(rawName.trim());
                const normalized = {
                    ...found,
                    name: rawName && !isPhoneNumber ? rawName : (customerId || "Unknown"),
                    phone: (found as any).phone || (found as any)["Phone"] || (found as any).lead_phone || customerId || "",
                    email: (found as any).email || (found as any)["Email"] || (found as any).lead_email || "",
                    source_loop: (found as any).source_loop || (found as any).campaign || "—",
                } as any;
                setLead(normalized);
                const f = found as any;
                let timeline: any[] = [];

                // If this is an activity lead with content, parse from content column
                if (f.content) {
                    timeline = parseActivityContent(f.content, f.summary);
                } else {
                    const parseMsg = (raw: any, label: string, type: 'bot' | 'user', sequence: number) => {
                        if (!raw || !String(raw).trim()) return null;
                        const content = String(raw).trim();

                        // Match ISO timestamp after one or two newlines at end of message
                        const isoRegex = /\n{1,2}(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.+)$/;
                        const isoMatch = content.match(isoRegex);
                        if (isoMatch) {
                            return {
                                type,
                                content: content.replace(isoRegex, '').trim(),
                                label,
                                date: isoMatch[1],
                                sequence
                            };
                        }

                        // Match "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM:SS.mmm" on the last line
                        const lines = content.split('\n');
                        const lastLine = lines[lines.length - 1].trim();
                        const spaceDateRegex = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/;
                        if (lines.length > 1 && spaceDateRegex.test(lastLine)) {
                            const d = new Date(lastLine.replace(' ', 'T'));
                            if (!isNaN(d.getTime())) {
                                return {
                                    type,
                                    content: lines.slice(0, -1).join('\n').trim() || 'Message Received',
                                    label,
                                    date: d.toISOString(),
                                    sequence
                                };
                            }
                        }

                        return { type, content, label, date: null, sequence };
                    };

                    // Helper: extract date from a TS field — date is always after the LAST " - "
                    // Handles "read - 12/3/2026, 9:53 am" and "failed - error text - 24/4/2026, 1:30 pm"
                    const parseTsDate = (tsRaw: string | null): string | null => {
                        if (!tsRaw) return null;
                        const lastDash = tsRaw.lastIndexOf(' - ');
                        if (lastDash === -1) return null;
                        const datePart = tsRaw.slice(lastDash + 3).trim();
                        const d = new Date(datePart.replace(/(^\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*/, '$3-$2-$1 ').trim());
                        return isNaN(d.getTime()) ? null : d.toISOString();
                    };

                    let seq = 1;

                    // Drip sequence W.P_1 → W.P_12  (skip missing slots, no duplicates)
                    for (let i = 1; i <= 12; i++) {
                        const raw = f[`W.P_${i}`] || f.stage_data?.[`WhatsApp ${i}`];
                        if (!raw) continue;
                        const tsRaw: string | null = f[`W.P_${i} TS`] || null;
                        const msg = parseMsg(raw, `W.P_${i}`, 'bot', seq++);
                        if (msg) {
                            (msg as any).tsStatus = tsRaw;
                            if (!msg.date) msg.date = parseTsDate(tsRaw);
                            timeline.push(msg);
                        }
                    }

                    // Paired reply / follow-up rounds (up to 10)
                    for (let i = 1; i <= 10; i++) {
                        const rRaw = f[`W.P_Replied_${i}`] || f[`W.P_Replied ${i}`];
                        const rMsg = parseMsg(rRaw, `W.P_Replied ${i}`, 'user', seq++);
                        if (rMsg) timeline.push(rMsg);

                        const fRaw = f[`W.P_FollowUp_${i}`] || f[`W.P_FollowUp ${i}`];
                        const fTsRaw: string | null = f[`W.P_FollowUp_TS${i}`] || null;
                        const fMsg = parseMsg(fRaw, `W.P_FollowUp ${i}`, 'bot', seq++);
                        if (fMsg) {
                            (fMsg as any).tsStatus = fTsRaw;
                            if (!fMsg.date) fMsg.date = parseTsDate(fTsRaw);
                            timeline.push(fMsg);
                        }
                    }
                }

                setMessages(timeline);
            } else {
                setLead(null);
                setMessages(EMPTY_MESSAGES);
            }
            setLoading(false);
        }

        loadLeadData();

        return () => {
            isMounted = false;
        };
    }, [customerId, allLeads, loadingLeads, initialLead]);

    // Fill missing timestamps by scanning neighbors and falling back to lead created_at
    const messagesWithDates = React.useMemo(() => {
        if (messages.length === 0) return messages;
        let lastDate: string | null = null;
        const fallbackDate = lead?.created_at || null;
        return messages.map((msg, idx) => {
            if (msg.date) {
                lastDate = msg.date;
                return msg;
            }
            let nextDate: string | null = null;
            for (let j = idx + 1; j < messages.length; j++) {
                if (messages[j].date) {
                    nextDate = messages[j].date;
                    break;
                }
            }
            const resolved = lastDate || nextDate || fallbackDate;
            return { ...msg, date: resolved };
        });
    }, [messages, lead]);

    if (loading) {
        return (
            <div className="h-[500px] flex flex-col items-center justify-center space-y-4 text-[var(--label-tertiary)]">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="font-medium">Fetching conversation history...</p>
            </div>
        );
    }

    if (!lead) {
        return (
            <div className="h-[500px] flex flex-col items-center justify-center space-y-4 text-[var(--label-tertiary)]">
                <MessageSquare className="h-12 w-12 opacity-20" />
                <p className="font-medium">Lead not found</p>
                {onClose && <Button variant="outline" onClick={onClose}>Close</Button>}
            </div>
        );
    }

    return (
        <div className="space-y-6 flex flex-col h-full overflow-hidden max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-[var(--label-primary)]">{lead.name}</h2>
                        {((lead as any).status || (lead as any).curr_lead_status) && (
                            <Badge className="bg-blue-100 text-blue-700 border-none text-[10px] font-bold uppercase">
                                {String((lead as any).status || (lead as any).curr_lead_status)}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--label-secondary)] mt-0.5">
                        <span>{lead.phone}</span>
                        <span>•</span>
                        <span>{lead.source_loop}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="default"
                        size="sm"
                        className={`gap-2 text-[10px] font-bold uppercase transition-all shadow-[var(--glass-shadow)] ${copied ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                        onClick={handleCopyLink}
                    >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <LinkIcon className="h-3.5 w-3.5" />}
                        {copied ? 'Copied' : 'Share Link'}
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden min-h-0">
                {/* Chat timeline */}
                <div className="lg:col-span-2 flex flex-col bg-[var(--glass-fill)] border border-[var(--separator)] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] overflow-hidden h-full min-h-0">
                    <div className="bg-[var(--glass-fill)] border-b border-[var(--separator)] p-3 px-4 flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-bold text-[var(--label-tertiary)] uppercase tracking-wider">Conversation Timeline</h3>
                        <div className="text-[10px] text-[var(--label-tertiary)] font-bold">{messages.length} Messages</div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {messagesWithDates.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-[var(--label-tertiary)] space-y-2">
                                <MessageSquare className="h-10 w-10 opacity-20" />
                                <p className="text-sm">No WhatsApp messages found in database.</p>
                            </div>
                        ) : (
                            messagesWithDates.map((msg, idx) => {
                                // Build delivery-status pill for outgoing messages
                                let tsPill: React.ReactNode = null;
                                if (msg.type === 'bot' && (msg as any).tsStatus) {
                                    const raw = String((msg as any).tsStatus);
                                    const label = raw.split(' - ')[0].trim();
                                    const formatted = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
                                    let cls = 'bg-emerald-500/30 text-emerald-100';
                                    if (formatted.includes('Read')) cls = 'bg-blue-400/40 text-blue-100';
                                    if (formatted.includes('Failed')) cls = 'bg-red-400/40 text-red-100';
                                    if (formatted.includes('Sent')) cls = 'bg-white/20 text-emerald-50';
                                    tsPill = (
                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${cls}`}>
                                            {formatted}
                                        </span>
                                    );
                                }

                                return (
                                    <div key={idx} className={`flex flex-col ${msg.type === 'user' ? 'items-start' : 'items-end'}`}>
                                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] ${msg.type === 'user'
                                            ? 'bg-[var(--bg-app)] text-[var(--label-primary)] border border-[var(--separator)] rounded-tl-none'
                                            : 'bg-emerald-600 text-white rounded-tr-none'
                                            }`}>
                                            <div className="flex items-center justify-between mb-2 gap-3">
                                                <span className={`text-[10px] font-bold uppercase tracking-wide ${msg.type === 'user' ? 'text-[var(--label-tertiary)]' : 'text-emerald-100'}`}>
                                                    {msg.label}
                                                </span>
                                                {tsPill}
                                            </div>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                                                {msg.content}
                                            </p>
                                        </div>
                                        {msg.date && (
                                            <span className="text-[10px] text-[var(--label-tertiary)] mt-1 px-1">
                                                {new Date(msg.date).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-1 h-full pb-4">
                    <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)]">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="text-sm font-bold text-[var(--label-primary)] flex items-center gap-2">
                                <User className="h-4 w-4 text-[var(--label-tertiary)]" /> Lead Information
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-[10px] font-bold text-[var(--label-tertiary)] uppercase">Contact info</span>
                                    <p className="font-medium text-[var(--label-primary)] mt-1">{lead.phone}</p>
                                    <p className="text-[var(--label-secondary)] text-xs">{lead.email}</p>
                                </div>
                                {((lead as any).status || (lead as any).curr_lead_status) && (
                                    <div>
                                        <span className="text-[10px] font-bold text-[var(--label-tertiary)] uppercase">Status</span>
                                        <Badge className="mt-1 bg-blue-100 text-blue-700 border-none text-[10px] font-bold uppercase block w-fit">
                                            {String((lead as any).status || (lead as any).curr_lead_status)}
                                        </Badge>
                                    </div>
                                )}
                                {((lead as any).lead_temp || (lead as any).lead_temperature || (lead as any)["Lead Temperature"] || (lead as any).sentiment) && (
                                    <div>
                                        <span className="text-[10px] font-bold text-[var(--label-tertiary)] uppercase">Lead Temperature</span>
                                        <Badge className="mt-1 bg-amber-100 text-amber-800 border-none text-[10px] font-bold uppercase block w-fit">
                                            {String((lead as any).lead_temp || (lead as any).lead_temperature || (lead as any)["Lead Temperature"] || (lead as any).sentiment)}
                                        </Badge>
                                    </div>
                                )}
                                {(lead as any)._source_table ? (
                                    <div>
                                        <span className="text-[10px] font-bold text-[var(--label-tertiary)] uppercase">Source Table</span>
                                        <p className="font-bold text-blue-600 mt-1 text-xs">
                                            {(lead as any)._source_table}
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <span className="text-[10px] font-bold text-[var(--label-tertiary)] uppercase">Source Table</span>
                                        <p className="font-bold text-blue-600 mt-1 text-xs">
                                            {String(lead.id || lead.source_loop || '').startsWith('intro') || String(lead.source_loop || '').toLowerCase() === 'intro' ? 'nr_wf' : (String(lead.id || lead.source_loop || '').startsWith('followup') || String(lead.source_loop || '').toLowerCase().includes('follow') ? 'followup' : 'nurture')}
                                        </p>
                                    </div>
                                )}
                                {(lead as any).summary ? (
                                    <div>
                                        <span className="text-[10px] font-bold text-[var(--label-tertiary)] uppercase">Summary</span>
                                        <p className="text-xs text-[var(--label-secondary)] mt-1 leading-relaxed">{(lead as any).summary}</p>
                                    </div>
                                ) : null}
                                {(lead as any).action_type ? (
                                    <div>
                                        <span className="text-[10px] font-bold text-[var(--label-tertiary)] uppercase">Action Type</span>
                                        <p className="font-bold text-purple-600 mt-1 text-xs capitalize">{(lead as any).action_type}</p>
                                    </div>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-[var(--separator)] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_8px_rgba(0,0,0,0.06)] bg-[var(--glass-fill)]">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="text-sm font-bold text-[var(--label-primary)]">Activity Stats</h3>
                            <div className="grid grid-cols-1 gap-2">
                                <StatBox label="Total Messages" value={messages.length} icon={MessageSquare} />
                                <StatBox label="Incoming" value={messages.filter(m => m.type === 'user').length} icon={User} />
                                <StatBox label="Outgoing" value={messages.filter(m => m.type === 'bot').length} icon={Bot} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function StatBox({ label, value, icon: Icon }: any) {
    return (
        <div className="p-2 px-3 bg-[var(--bg-app)] rounded-lg border border-[var(--separator)] flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-[var(--label-tertiary)]" />
                <span className="text-[10px] text-[var(--label-secondary)] uppercase tracking-wide font-bold">{label}</span>
            </div>
            <span className="text-sm font-bold text-[var(--label-primary)]">{value}</span>
        </div>
    );
}

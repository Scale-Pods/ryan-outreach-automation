"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    MessageSquare,
    User,
    Bot,
    Link as LinkIcon,
    Check,
    Languages,
    Smartphone,
    Send,
    AlertCircle,
    CheckCircle2
} from "lucide-react";
import { useData } from "@/context/DataContext";

function getSmsStatusBadge(statusRaw?: string) {
    if (!statusRaw || !String(statusRaw).trim()) {
        return <Badge variant="outline" className="text-[10px] text-slate-400 border-white/10 uppercase font-bold">SENT</Badge>;
    }
    const s = String(statusRaw).trim().toLowerCase();
    if (s === 'delivered' || s === 'completed') {
        return (
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase gap-1">
                <CheckCircle2 className="h-3 w-3" /> DELIVERED
            </Badge>
        );
    }
    if (s === 'failed' || s === 'error' || s === 'undelivered') {
        return (
            <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase gap-1">
                <AlertCircle className="h-3 w-3" /> FAILED
            </Badge>
        );
    }
    if (s === 'replied' || s === 'reply') {
        return (
            <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase gap-1">
                <MessageSquare className="h-3 w-3" /> REPLIED
            </Badge>
        );
    }
    return (
        <Badge variant="outline" className="text-[10px] text-sky-400 border-sky-500/30 bg-sky-500/10 uppercase font-bold">
            {s.toUpperCase()}
        </Badge>
    );
}

function parseSmsContent(content: string, note?: string): any[] {
    if (!content && !note) return [];
    const messages: any[] = [];
    const rawText = content || note || "";
    const lines = rawText.split('\n');
    let seq = 0;
    let lastMessageKey = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Check if line is a Date & Time / Timestamp header line
        const dtMatch = line.match(/^(?:Date\s*&\s*Time|Date|Timestamp):\s*(.*)$/i);
        if (dtMatch) {
            const rawDt = dtMatch[1].trim();
            if (messages.length > 0) {
                const tsMatch = rawDt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)/i);
                if (tsMatch) {
                    const parsed = new Date(`${tsMatch[3]}-${tsMatch[1].padStart(2,'0')}-${tsMatch[2].padStart(2,'0')}T${tsMatch[4]}`);
                    messages[messages.length - 1].date = !isNaN(parsed.getTime()) ? parsed.toISOString() : rawDt;
                } else {
                    messages[messages.length - 1].date = rawDt;
                }
            }
            continue; // Skip adding timestamp line inside message content
        }

        if (line.startsWith('Template: ') || line.startsWith('Outbound SMS: ') || line.startsWith('SMS: ')) {
            const text = line.replace(/^(Template|Outbound SMS|SMS):\s*/, '').trim();
            const msg = {
                type: 'bot' as const,
                content: text,
                label: 'Outbound SMS',
                date: null as string | null,
                sequence: ++seq,
            };
            messages.push(msg);
            lastMessageKey = 'bot';
            continue;
        }

        if (line.startsWith('User: ') || line.startsWith('Inbound SMS: ')) {
            const text = line.replace(/^(User|Inbound SMS):\s*/, '').trim();
            const key = `user:${text}`;
            if (key === lastMessageKey) continue;
            const msg = {
                type: 'user' as const,
                content: text,
                label: 'Lead Reply',
                date: null as string | null,
                sequence: ++seq,
            };
            messages.push(msg);
            lastMessageKey = key;
            continue;
        }

        if (line.startsWith('Agent : ') || line.startsWith('Agent: ')) {
            const text = line.replace(/^Agent\s*:\s*/, '').trim();
            const msg = {
                type: 'bot' as const,
                content: text,
                label: 'Agent Reply',
                date: null as string | null,
                sequence: ++seq,
            };
            messages.push(msg);
            lastMessageKey = `bot:${text}`;
            continue;
        }

        const tsMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4}),\s*(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))/i);
        if (tsMatch) {
            const dateStr = `${tsMatch[1]} ${tsMatch[2]}`;
            const [m, d, y] = dateStr.split(/[\/\s,]+/);
            const timeStr = dateStr.match(/\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)/i)?.[0] || '';
            const parsed = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}T${timeStr}`);
            if (!isNaN(parsed.getTime()) && messages.length > 0) {
                messages[messages.length - 1].date = parsed.toISOString();
            }
            continue;
        }

        if (messages.length > 0) {
            messages[messages.length - 1].content += '\n' + line;
        } else {
            messages.push({
                type: 'bot' as const,
                content: line,
                label: 'Outbound SMS',
                date: null as string | null,
                sequence: ++seq,
            });
        }
    }

    // Secondary cleanup: strip ALL embedded timestamp/date lines inside msg.content
    messages.forEach(msg => {
        if (msg.content) {
            if (!msg.date) {
                const dtMatch = msg.content.match(/(?:Date\s*&\s*Time|Date|Timestamp):\s*([^\n]+)/i);
                if (dtMatch) {
                    const rawDt = dtMatch[1].trim();
                    const tsMatch = rawDt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?)/i);
                    if (tsMatch) {
                        const parsed = new Date(`${tsMatch[3]}-${tsMatch[1].padStart(2,'0')}-${tsMatch[2].padStart(2,'0')}T${tsMatch[4]}`);
                        msg.date = !isNaN(parsed.getTime()) ? parsed.toISOString() : rawDt;
                    } else {
                        msg.date = rawDt;
                    }
                }
            }
            // Strip any "Date & Time: ...", "Date: ...", "Timestamp: ..." lines from inside the message text box
            msg.content = msg.content
                .replace(/\n?\s*(?:Date\s*&\s*Time|Date|Timestamp):\s*[^\n]+/gi, '')
                .replace(/\n?\s*\d{1,2}\/\d{1,2}\/\d{4},\s*\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)?/gi, '')
                .trim();
        }
    });

    return messages;
}

interface SMSChatDetailProps {
    customerId: string;
    onClose?: () => void;
    initialLead?: any;
}

const EMPTY_LEADS: any[] = [];

export function SMSChatDetail({ customerId, onClose, initialLead }: SMSChatDetailProps) {
    let dataContext: any = {};
    try {
        dataContext = useData();
    } catch (e) {
        // public view fallback
    }
    const { leads: allLeads = EMPTY_LEADS, loadingLeads = false } = dataContext;
    const [lead, setLead] = useState<any | null>(initialLead || null);
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<any[]>([]);
    const [copied, setCopied] = useState(false);
    const [isTranslated, setIsTranslated] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [translatedMessages, setTranslatedMessages] = useState<Record<number, string>>({});

    const handleTranslate = async () => {
        if (isTranslated) {
            setIsTranslated(false);
            return;
        }
        if (Object.keys(translatedMessages).length > 0) {
            setIsTranslated(true);
            return;
        }
        setIsTranslating(true);
        try {
            const textsToTranslate = messages.map(m => m.content);
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts: textsToTranslate })
            });

            if (response.ok) {
                const data = await response.json();
                const translations = data.translatedTexts || [];
                const newTranslations: Record<number, string> = {};
                translations.forEach((t: string, idx: number) => {
                    newTranslations[idx] = t;
                });
                setTranslatedMessages(newTranslations);
                setIsTranslated(true);
            }
        } catch (e) {
            console.error('Translation error:', e);
        } finally {
            setIsTranslating(false);
        }
    };

    const fetchLeadAndMessages = async () => {
        setLoading(true);
        try {
            let foundLead = initialLead;
            if (!foundLead && customerId) {
                foundLead = allLeads.find((l: any) =>
                    String(l["Lead ID"] || l.id) === String(customerId) ||
                    String(l.Phone || l.phone) === String(customerId)
                );
            }

            const res = await fetch(`/api/activity?channel=sms&search=${encodeURIComponent(customerId)}`);
            let actLogs: any[] = [];
            if (res.ok) {
                const data = await res.json();
                actLogs = data.activities || [];
            }

            if (!foundLead && actLogs.length > 0) {
                const first = actLogs[0];
                foundLead = {
                    "Lead ID": first.lead_id || customerId,
                    "Name": first.lead_name || "SMS Lead",
                    "Phone": first.lead_phone || customerId,
                    "Email": first.lead_email || "",
                    source_loop: first.campaign || first.source_loop || "SMS Campaign",
                    status: first.status || "delivered",
                    lead_temp: first.lead_temp || first.sentiment || "warm",
                };
            }

            setLead(foundLead || { "Name": customerId, "Phone": customerId, source_loop: "SMS Campaign" });

            const parsedMsgs: any[] = [];
            actLogs.forEach(act => {
                const msgs = parseSmsContent(act.content, act.note);
                msgs.forEach(m => {
                    if (act.created_at && !m.date) m.date = act.created_at;
                });
                parsedMsgs.push(...msgs);
            });

            if (parsedMsgs.length === 0 && foundLead?.content) {
                parsedMsgs.push(...parseSmsContent(foundLead.content, foundLead.note));
            }

            setMessages(parsedMsgs);
        } catch (err) {
            console.error('[SMSChatDetail]', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeadAndMessages();
    }, [customerId, initialLead]);

    const copyLink = () => {
        const shareId = lead?.["Lead ID"] || lead?.id || customerId;
        const shareUrl = `${window.location.origin}/share/sms/${encodeURIComponent(shareId)}`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const leadName = lead?.["Name"] || lead?.name || customerId || "Unknown Lead";
    const leadPhone = lead?.["Phone"] || lead?.phone || "";
    const sourceLoop = lead?.source_loop || lead?.campaign || "SMS Campaign";

    return (
        <div className="space-y-6 flex flex-col h-full overflow-hidden max-h-[85vh] text-white">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0 bg-[#0d121f] p-4 rounded-xl border border-white/10 shadow-lg">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                            <Smartphone className="h-4 w-4" />
                        </div>
                        <h2 className="text-xl font-bold text-white">{leadName}</h2>
                        {getSmsStatusBadge(lead?.status || lead?.workflow_status)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 pl-10">
                        <span className="font-mono">{leadPhone}</span>
                        <span>•</span>
                        <span>{sourceLoop}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 pr-8">
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={isTranslating || messages.length === 0}
                        className={`gap-2 text-xs font-bold uppercase transition-all rounded-full border border-white/10 ${
                            isTranslated ? 'text-blue-400 bg-blue-500/10 border-blue-500/30' : 'text-slate-300 hover:bg-white/10'
                        }`}
                        onClick={handleTranslate}
                    >
                        {isTranslating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                        {isTranslated ? 'Original' : 'Translate'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-2 text-xs font-bold uppercase transition-all rounded-full border border-white/10 ${
                            copied ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-slate-300 hover:bg-white/10'
                        }`}
                        onClick={copyLink}
                    >
                        {copied ? <Check className="h-3.5 w-3.5 text-white" /> : <LinkIcon className="h-3.5 w-3.5" />}
                        {copied ? 'Copied' : 'Share Link'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchLeadAndMessages}
                        disabled={loading}
                        className="text-slate-300 hover:bg-white/10 rounded-full h-8 w-8 p-0 flex items-center justify-center border border-white/10"
                        title="Refresh thread"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Content 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden min-h-0">
                {/* Chat timeline */}
                <div className="lg:col-span-2 flex flex-col bg-[#0d121f] border border-white/10 rounded-xl shadow-xl overflow-hidden h-full min-h-0">
                    <div className="bg-white/[0.03] border-b border-white/10 p-3 px-4 flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">SMS Conversation Timeline</h3>
                        <div className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                            {messages.length} Messages
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-950/40">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                <RefreshCw className="h-8 w-8 animate-spin text-blue-400" />
                                <p className="text-sm">Fetching SMS conversation history...</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                <MessageSquare className="h-10 w-10 opacity-20 text-blue-400" />
                                <p className="text-sm">No SMS messages found in database.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                const isUser = msg.type === 'user';
                                const text = (isTranslated && translatedMessages[idx]) ? translatedMessages[idx] : msg.content;
                                return (
                                    <div key={idx} className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}>
                                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-md ${
                                            isUser
                                                ? 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tl-none'
                                                : 'bg-blue-600 text-white rounded-tr-none shadow-blue-900/30'
                                        }`}>
                                            <div className="flex items-center justify-between mb-2 gap-3 border-b border-white/10 pb-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-wide ${isUser ? 'text-indigo-300' : 'text-blue-100'}`}>
                                                    {msg.label || (isUser ? 'Lead Reply' : 'Outbound SMS')}
                                                </span>
                                            </div>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans">{text}</p>
                                        </div>
                                        {msg.date && (
                                            <span className="text-[10px] text-slate-400 mt-1 px-1 font-mono">
                                                {!isNaN(new Date(msg.date).getTime())
                                                    ? new Date(msg.date).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
                                                    : msg.date}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Lead Details Sidebar */}
                <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-1 h-full pb-4">
                    <Card className="border-white/10 shadow-xl bg-[#0d121f] text-white">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <User className="h-4 w-4 text-blue-400" /> Lead Information
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Contact info</span>
                                    <p className="font-medium text-white mt-1 font-mono">{leadPhone}</p>
                                    {lead?.email && <p className="text-slate-400 text-xs">{lead.email}</p>}
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Campaign</span>
                                    <Badge className="mt-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold uppercase block w-fit">
                                        {sourceLoop}
                                    </Badge>
                                </div>
                                 {(lead?.status || lead?.workflow_status) && (
                                     <div>
                                         <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                                         <div className="mt-1">{getSmsStatusBadge(lead.status || lead.workflow_status)}</div>
                                     </div>
                                 )}
                                {(lead?.lead_temp || lead?.sentiment) && (
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Lead Temperature</span>
                                        <Badge className="mt-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold uppercase block w-fit">
                                            {String(lead.lead_temp || lead.sentiment)}
                                        </Badge>
                                    </div>
                                )}
                                {lead?._source_table && (
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Source Table</span>
                                        <p className="font-bold text-blue-400 mt-1 text-xs">{lead._source_table}</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-white/10 shadow-xl bg-[#0d121f] text-white">
                        <CardContent className="p-4 space-y-3">
                            <h3 className="text-sm font-bold text-white">Activity Stats</h3>
                            <div className="grid grid-cols-1 gap-2">
                                <StatBox label="Total Messages" value={messages.length} icon={MessageSquare} />
                                <StatBox label="Incoming Replies" value={messages.filter(m => m.type === 'user').length} icon={User} />
                                <StatBox label="Outbound SMS" value={messages.filter(m => m.type === 'bot').length} icon={Bot} />
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
        <div className="p-2.5 px-3 bg-slate-900/80 rounded-xl border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-[10px] text-slate-300 uppercase tracking-wide font-bold">{label}</span>
            </div>
            <span className="text-sm font-bold text-white font-mono">{value}</span>
        </div>
    );
}

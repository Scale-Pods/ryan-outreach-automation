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
    Check,
    Languages
} from "lucide-react";
import { ConsolidatedLead } from "@/lib/leads-utils";
import { useData } from "@/context/DataContext";

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
                messages.forEach((m, i) => {
                    if (translations[i]) newTranslations[i] = translations[i];
                });
                setTranslatedMessages(newTranslations);
                setIsTranslated(true);
            }
        } catch (error) {
            console.error("Translation failed:", error);
        } finally {
            setIsTranslating(false);
        }
    };

    const handleCopyLink = () => {
        if (!lead) return;
        const baseUrl = window.location.origin;
        // Construct the URL using the ID as it's more stable for routing
        const shareId = lead.id || lead.phone;
        const shareUrl = `${baseUrl}/chat/${encodeURIComponent(shareId)}`;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }).catch(err => {
                console.error("Failed to copy link:", err);
            });
        } else {
            // Fallback for non-secure contexts
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
        if (!initialLead && loadingLeads) {
            setLoading(true);
            return;
        }

        const searchVal = String(customerId).toLowerCase().trim();
        const found = initialLead || allLeads.find((l: { id: any; phone: any; }) => {
            if (String(l.id).toLowerCase() === searchVal) return true;
            if (l.phone) {
                const lPhoneReplaced = String(l.phone).replace(/\D/g, '');
                const searchReplaced = searchVal.replace(/\D/g, '');
                if (searchReplaced && lPhoneReplaced === searchReplaced) return true;
            }
            return false;
        }) || null;

        if (found) {
            // Normalize raw API leads (have "Name", "Phone", "source_loop") into ConsolidatedLead shape
            const rawName = (found as any).name || (found as any)["Name"] || "";
            const isPhoneNumber = /^\+?\d[\d\s\-().]{4,}$/.test(rawName.trim());
            const normalized = {
                ...found,
                name: rawName && !isPhoneNumber ? rawName : "Unknown",
                phone: (found as any).phone || (found as any)["Phone"] || "",
                email: (found as any).email || (found as any)["Email"] || "",
                source_loop: (found as any).source_loop || "—",
            } as any;
            setLead(normalized);
            const timeline: any[] = [];

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

            const f = found as any;
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
            // DB columns use spaces: "W.P_Replied 1", "W.P_FollowUp 1"
            // RPC aliases them with underscores: "W.P_Replied_1", "W.P_FollowUp_1"
            // Try both forms so this works before and after migration 007.
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

            // No date sorting — insertion sequence IS the correct conversation order:
            // W.P_1 → W.P_N drips, then WhatsApp Replied, then W.P_FollowUp,
            // then paired W.P_Replied_i / W.P_FollowUp_i rounds.

            setMessages(timeline);
        } else {
            setLead(null);
            setMessages(EMPTY_MESSAGES);
        }
        setLoading(false);
    }, [customerId, allLeads, loadingLeads, initialLead]);

    if (loading) {
        return (
            <div className="h-[500px] flex flex-col items-center justify-center space-y-4 text-slate-400">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="font-medium">Fetching conversation history...</p>
            </div>
        );
    }

    if (!lead) {
        return (
            <div className="h-[500px] flex flex-col items-center justify-center space-y-4 text-slate-400">
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
                    <h2 className="text-xl font-bold text-slate-900">{lead.name}</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{lead.phone}</span>
                        <span>•</span>
                        <span>{lead.source_loop}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={isTranslating}
                        className={`gap-2 text-[10px] font-bold uppercase transition-all ${isTranslated ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-900'}`}
                        onClick={handleTranslate}
                    >
                        {isTranslating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Languages className="h-3.5 w-3.5" />}
                        {isTranslated ? 'Original' : 'Translate'}
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        className={`gap-2 text-[10px] font-bold uppercase transition-all shadow-md ${copied ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700 text-white'}`}
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
                <div className="lg:col-span-2 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden h-full min-h-0">
                    <div className="bg-slate-50/50 border-b border-slate-100 p-3 px-4 flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conversation Timeline</h3>
                        <div className="text-[10px] text-slate-400 font-bold">{messages.length} Messages</div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2">
                                <MessageSquare className="h-10 w-10 opacity-20" />
                                <p className="text-sm">No WhatsApp messages found in database.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
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
                                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.type === 'user'
                                            ? 'bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none'
                                            : 'bg-emerald-600 text-white rounded-tr-none'
                                            }`}>
                                            <div className="flex items-center justify-between mb-2 gap-3">
                                                <span className={`text-[10px] font-bold uppercase tracking-wide ${msg.type === 'user' ? 'text-slate-400' : 'text-emerald-100'}`}>
                                                    {msg.label}
                                                </span>
                                                {tsPill}
                                            </div>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                                                {isTranslated && translatedMessages[idx] ? (
                                                    <span className="relative">
                                                        <span className="block mb-1 text-[10px] uppercase font-bold opacity-50">English Translation:</span>
                                                        {translatedMessages[idx]}
                                                    </span>
                                                ) : msg.content}
                                            </p>
                                        </div>
                                        {msg.date && (
                                            <span className="text-[10px] text-slate-400 mt-1 px-1">
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
                    <Card className="border-slate-200 shadow-sm bg-white">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <User className="h-4 w-4 text-slate-400" /> Lead Information
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Contact info</span>
                                    <p className="font-medium text-slate-900 mt-1">{lead.phone}</p>
                                    <p className="text-slate-500 text-xs">{lead.email}</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Campaign</span>
                                    <Badge className="mt-1 bg-purple-100 text-purple-700 hover:bg-purple-100 border-none text-[10px] font-bold uppercase block w-fit">
                                        {lead.source_loop}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Source Table</span>
                                    <p className="font-bold text-blue-600 mt-1 text-xs">
                                        {String(lead.id || lead.source_loop || '').startsWith('intro') || String(lead.source_loop || '').toLowerCase() === 'intro' ? 'nr_wf' : (String(lead.id || lead.source_loop || '').startsWith('followup') || String(lead.source_loop || '').toLowerCase().includes('follow') ? 'followup' : 'nurture')}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-sm bg-white">
                        <CardContent className="p-4 space-y-4">
                            <h3 className="text-sm font-bold text-slate-900">Activity Stats</h3>
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
        <div className="p-2 px-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{label}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">{value}</span>
        </div>
    );
}

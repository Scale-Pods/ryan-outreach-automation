"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    RefreshCw,
    Download,
    Mail,
    User,
    Bot,
    Link as LinkIcon,
    Check,
    Languages,
    Send,
    Inbox,
    Share2,
    X
} from "lucide-react";
import { useData } from "@/context/DataContext";

function parseEmailContent(content: string, note?: string): any[] {
    if (!content && !note) return [];
    const messages: any[] = [];
    const rawText = content || note || "";
    const lines = rawText.split('\n');
    let seq = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('Subject: ')) {
            messages.push({
                type: 'subject' as const,
                content: line.substring('Subject: '.length),
                sequence: ++seq
            });
            continue;
        }

        if (line.startsWith('Outbound Email:') || line.startsWith('Email Sent:') || line.startsWith('Template:')) {
            const text = line.replace(/^(Outbound Email|Email Sent|Template):\s*/, '').trim();
            messages.push({
                type: 'bot' as const,
                content: text,
                label: 'Outbound Email',
                date: null as string | null,
                sequence: ++seq
            });
            continue;
        }

        if (line.startsWith('Inbound Reply:') || line.startsWith('User:') || line.startsWith('Email Reply:')) {
            const text = line.replace(/^(Inbound Reply|User|Email Reply):\s*/, '').trim();
            messages.push({
                type: 'user' as const,
                content: text,
                label: 'Recipient Reply',
                date: null as string | null,
                sequence: ++seq
            });
            continue;
        }

        if (messages.length > 0) {
            messages[messages.length - 1].content += '\n' + line;
        } else {
            messages.push({
                type: 'bot' as const,
                content: line,
                label: 'Outbound Email',
                date: null as string | null,
                sequence: ++seq
            });
        }
    }

    return messages;
}

interface EmailChatDetailProps {
    leadId: string;
    onClose?: () => void;
    initialLead?: any;
}

const EMPTY_LEADS: any[] = [];

export function EmailChatDetail({ leadId, onClose, initialLead }: EmailChatDetailProps) {
    let dataContext: any = {};
    try {
        dataContext = useData();
    } catch (e) {
        // fallback
    }
    const { leads: allLeads = EMPTY_LEADS } = dataContext;
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

    const fetchLeadAndEmailThread = async () => {
        setLoading(true);
        try {
            let foundLead = initialLead;
            if (!foundLead && leadId) {
                foundLead = allLeads.find((l: any) =>
                    String(l["Lead ID"] || l.id) === String(leadId) ||
                    String(l.Email || l.email) === String(leadId)
                );
            }

            if (!foundLead && leadId) {
                try {
                    const leadsRes = await fetch('/api/leads');
                    if (leadsRes.ok) {
                        const data = await leadsRes.json();
                        const allFetched = [
                            ...(data.master_leads || []),
                            ...(data.nr_wf || []),
                            ...(data.followup || []),
                            ...(data.nurture || []),
                            ...(data.activity_leads || []),
                        ];
                        foundLead = allFetched.find((l: any) =>
                            String(l["Lead ID"] || l.id) === String(leadId) ||
                            String(l.Email || l.email) === String(leadId)
                        );
                    }
                } catch (e) {
                    console.error("Error fetching fallback leads in EmailChatDetail:", e);
                }
            }

            const res = await fetch(`/api/activity?channel=email&search=${encodeURIComponent(leadId)}`);
            let actLogs: any[] = [];
            if (res.ok) {
                const data = await res.json();
                actLogs = data.activities || [];
            }

            if (!foundLead && actLogs.length > 0) {
                const first = actLogs[0];
                foundLead = {
                    "Lead ID": first.lead_id || leadId,
                    "Name": first.lead_name || "Email Lead",
                    "Email": first.lead_email || leadId,
                    "Phone": first.lead_phone || "",
                    status: first.status || "sent",
                };
            }

            setLead(foundLead || { "Name": leadId, "Email": leadId });

            const parsedMsgs: any[] = [];
            actLogs.forEach(act => {
                const msgs = parseEmailContent(act.content, act.note);
                msgs.forEach(m => {
                    if (act.created_at && !m.date) m.date = act.created_at;
                });
                parsedMsgs.push(...msgs);
            });

            if (parsedMsgs.length === 0 && foundLead) {
                for (let i = 1; i <= 10; i++) {
                    const e = foundLead[`Email_${i}`] || foundLead[`Email ${i}`];
                    if (e) {
                        parsedMsgs.push({
                            type: 'bot',
                            content: String(e),
                            label: `Email #${i}`,
                            date: foundLead[`Email_${i}_TS`] || null,
                            sequence: i
                        });
                    }
                }
                const reply = foundLead.email_replied || foundLead["Email Replied"];
                if (reply && String(reply).toLowerCase() !== 'no' && String(reply).trim() !== '') {
                    parsedMsgs.push({
                        type: 'user',
                        content: String(reply),
                        label: 'Recipient Reply',
                        date: foundLead.replied_at || null,
                        sequence: parsedMsgs.length + 1
                    });
                }
            }

            setMessages(parsedMsgs);
        } catch (err) {
            console.error('[EmailChatDetail]', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeadAndEmailThread();
    }, [leadId, initialLead]);

    const copyShareLink = () => {
        const rawEmail = lead?.["Email"] || lead?.email || lead?.lead_email || leadId;
        const shareId = String(rawEmail).trim() || lead?.["Lead ID"] || lead?.id || leadId;
        const shareUrl = `${window.location.origin}/share/email/${encodeURIComponent(shareId)}`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const leadName = lead?.["Name"] || lead?.name || leadId || "Unknown Contact";
    const leadEmail = lead?.["Email"] || lead?.email || "";

    return (
        <div className="flex flex-col h-full bg-[#0d121f] text-white rounded-xl overflow-hidden border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.03]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                        <Mail className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-lg text-white">{leadName}</h3>
                        <p className="text-xs text-slate-400 font-mono">{leadEmail}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleTranslate}
                        disabled={isTranslating || messages.length === 0}
                        className={`gap-1.5 text-xs rounded-full border border-white/10 ${isTranslated ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/10'}`}
                    >
                        <Languages className="h-3.5 w-3.5" />
                        {isTranslating ? "Translating..." : isTranslated ? "Original" : "Translate"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyShareLink}
                        className="gap-1.5 text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-full border border-blue-500/30"
                    >
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
                        {copied ? "Link Copied!" : "Copy Share Link"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchLeadAndEmailThread}
                        className="text-slate-300 hover:bg-white/10 rounded-full h-8 w-8 p-0 flex items-center justify-center border border-white/10"
                        title="Refresh thread"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    {onClose && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full h-8 w-8 p-0 flex items-center justify-center border border-white/10"
                            title="Close modal"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Conversation Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/40">
                {loading ? (
                    <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                        <RefreshCw className="h-5 w-5 animate-spin mr-2 text-blue-400" /> Loading Email thread...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm gap-2">
                        <Mail className="h-8 w-8 opacity-30 text-blue-400" />
                        <span>No Email activity recorded for this contact yet.</span>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isUser = msg.type === 'user';
                        const text = (isTranslated && translatedMessages[index]) ? translatedMessages[index] : msg.content;
                        return (
                            <div key={index} className={`flex ${isUser ? 'justify-start' : 'justify-end'} gap-2.5`}>
                                {isUser && (
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 text-xs font-bold flex-shrink-0 mt-1">
                                        <User className="h-4 w-4" />
                                    </div>
                                )}
                                <div className={`max-w-[80%] rounded-2xl p-4 text-sm shadow-md ${
                                    isUser
                                        ? 'bg-slate-800 text-slate-100 border border-slate-700/60 rounded-tl-none'
                                        : 'bg-blue-600/90 text-white rounded-tr-none'
                                }`}>
                                    <div className="flex items-center justify-between gap-3 mb-2 text-[11px] opacity-75 border-b border-white/10 pb-1">
                                        <span className="font-semibold">{msg.label || (isUser ? 'Recipient' : 'Sender')}</span>
                                        {msg.date && (
                                            <span className="font-mono text-[10px]">
                                                {new Date(msg.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                        )}
                                    </div>
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
                                </div>
                                {!isUser && (
                                    <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300 text-xs font-bold flex-shrink-0 mt-1">
                                        <Bot className="h-4 w-4" />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

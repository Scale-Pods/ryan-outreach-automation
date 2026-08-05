"use client";

import React, { useState, useEffect, use } from "react";
import { RefreshCw, Mail, User, Bot, Link as LinkIcon, Check, Languages, AlertCircle, Inbox } from "lucide-react";

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
            messages.push({ type: 'subject', content: line.substring('Subject: '.length), sequence: ++seq });
            continue;
        }

        if (line.startsWith('Outbound Email:') || line.startsWith('Email Sent:') || line.startsWith('Template:')) {
            const text = line.replace(/^(Outbound Email|Email Sent|Template):\s*/, '').trim();
            messages.push({ type: 'bot', content: text, label: 'Outbound Email', date: null, sequence: ++seq });
            continue;
        }

        if (line.startsWith('Inbound Email:') || line.startsWith('Reply:') || line.startsWith('User:')) {
            const text = line.replace(/^(Inbound Email|Reply|User):\s*/, '').trim();
            messages.push({ type: 'user', content: text, label: 'Reply', date: null, sequence: ++seq });
            continue;
        }

        if (line.startsWith('Agent:') || line.startsWith('Agent :')) {
            const text = line.replace(/^Agent\s*:\s*/, '').trim();
            messages.push({ type: 'bot', content: text, label: 'Agent', date: null, sequence: ++seq });
            continue;
        }

        const tsMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4}),\s*(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))/i);
        if (tsMatch) {
            const [m, d, y] = tsMatch[1].split('/');
            const parsed = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${tsMatch[2]}`);
            if (!isNaN(parsed.getTime()) && messages.length > 0) {
                messages[messages.length - 1].date = parsed.toISOString();
            }
            continue;
        }

        if (messages.length > 0) {
            messages[messages.length - 1].content += '\n' + line;
        } else {
            messages.push({ type: 'bot', content: line, label: 'Email', date: null, sequence: ++seq });
        }
    }

    return messages;
}

export default function PublicEmailSharePage({ params }: { params: Promise<{ leadId: string }> }) {
    const { leadId } = use(params);
    const decodedLeadId = decodeURIComponent(leadId || '');

    const [lead, setLead] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isTranslated, setIsTranslated] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [translatedMessages, setTranslatedMessages] = useState<Record<number, string>>({});

    useEffect(() => {
        if (!decodedLeadId) return;

        async function loadData() {
            setLoading(true);
            setError(null);

            // Determine search param: phone numbers go by phone, emails go by email
            const isPhone = /^\+?\d[\d\s\-().]{4,}$/.test(decodedLeadId.replace(/\s/g, ''));
            const query = isPhone
                ? `channel=email&phone=${encodeURIComponent(decodedLeadId)}`
                : `channel=email&email=${encodeURIComponent(decodedLeadId)}`;

            try {
                const res = await fetch(`/api/public/share?${query}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' },
                });

                if (!res.ok) {
                    setError('Failed to load email thread data.');
                    setLoading(false);
                    return;
                }

                const data = await res.json();
                setLead(data.lead || { name: decodedLeadId, email: decodedLeadId });

                const allMessages: any[] = [];
                for (const act of (data.activities || [])) {
                    if (act.content || act.note) {
                        const parsed = parseEmailContent(act.content, act.note);
                        parsed.forEach(m => {
                            if (!m.date && act.created_at) m.date = act.created_at;
                        });
                        allMessages.push(...parsed);
                    }
                }
                setMessages(allMessages);
            } catch (e) {
                setError('Network error loading email thread.');
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [decodedLeadId]);

    const handleCopyLink = () => {
        const url = window.location.href;
        navigator.clipboard?.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleTranslate = async () => {
        if (isTranslated) { setIsTranslated(false); return; }
        if (Object.keys(translatedMessages).length > 0) { setIsTranslated(true); return; }
        setIsTranslating(true);
        try {
            const res = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texts: messages.map(m => m.content) }),
            });
            if (res.ok) {
                const d = await res.json();
                const map: Record<number, string> = {};
                (d.translatedTexts || []).forEach((t: string, i: number) => { if (t) map[i] = t; });
                setTranslatedMessages(map);
                setIsTranslated(true);
            }
        } catch { } finally { setIsTranslating(false); }
    };

    return (
        <div className="min-h-screen bg-[#0a0d14] text-white flex flex-col items-center justify-center p-4 md:p-8 relative">
            <div className="fixed -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600/20 blur-[120px] pointer-events-none z-0" />
            <div className="fixed -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-[120px] pointer-events-none z-0" />

            <div className="w-full max-w-5xl min-h-[88vh] bg-[#0d121f]/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl p-4 sm:p-6 flex flex-col relative z-10">

                <div className="mb-4 flex items-center justify-between shrink-0">
                    <span className="text-xs font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full font-semibold">
                        ✉️ Email Thread • {decodedLeadId}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleTranslate}
                            disabled={isTranslating || loading}
                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 hover:text-white border border-white/10 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50"
                        >
                            {isTranslating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
                            {isTranslated ? 'Original' : 'Translate'}
                        </button>
                        <button
                            onClick={handleCopyLink}
                            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase rounded-lg px-3 py-1.5 transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                        >
                            {copied ? <Check className="h-3 w-3" /> : <LinkIcon className="h-3 w-3" />}
                            {copied ? 'Copied!' : 'Copy Link'}
                        </button>
                    </div>
                </div>

                {lead && !loading && (
                    <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-4 shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                            {String(lead.name || lead.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-white">{lead.name || 'Unknown Contact'}</p>
                            <p className="text-xs text-slate-400">{lead.email} {lead.phone ? `• ${lead.phone}` : ''} {lead.campaign ? `• ${lead.campaign}` : ''}</p>
                        </div>
                        <div className="ml-auto text-right">
                            <p className="text-[10px] font-bold uppercase text-slate-500">Emails</p>
                            <p className="text-lg font-bold text-blue-400">{messages.length}</p>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] flex flex-col min-h-0">
                    <div className="border-b border-white/10 p-3 px-4 flex justify-between items-center shrink-0">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Thread</h3>
                        <div className="text-[10px] text-slate-500 font-bold">{messages.length} Emails</div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {loading ? (
                            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
                                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                                <p className="text-sm font-medium">Loading email thread…</p>
                            </div>
                        ) : error ? (
                            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
                                <AlertCircle className="h-10 w-10 opacity-20" />
                                <p className="text-sm">{error}</p>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
                                <Inbox className="h-10 w-10 opacity-20" />
                                <p className="text-sm">No email messages found for this contact.</p>
                            </div>
                        ) : (
                            messages.map((msg, idx) => {
                                if (msg.type === 'subject') return (
                                    <div key={idx} className="text-xs text-slate-400 font-bold uppercase text-center py-1">
                                        Subject: {msg.content}
                                    </div>
                                );
                                return (
                                    <div key={idx} className={`flex flex-col ${msg.type === 'user' ? 'items-start' : 'items-end'}`}>
                                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-md text-sm leading-relaxed ${msg.type === 'user'
                                            ? 'bg-[#1a2035] text-white border border-white/10 rounded-tl-none'
                                            : 'bg-blue-600 text-white rounded-tr-none'}`}
                                        >
                                            <p className={`text-[10px] font-bold uppercase mb-1 ${msg.type === 'user' ? 'text-slate-400' : 'text-blue-100'}`}>
                                                {msg.type === 'user'
                                                    ? <span className="flex items-center gap-1"><User className="h-3 w-3" />Contact Reply</span>
                                                    : <span className="flex items-center gap-1"><Bot className="h-3 w-3" />Agent Email</span>}
                                            </p>
                                            <p className="whitespace-pre-wrap">
                                                {isTranslated && translatedMessages[idx] ? (
                                                    <span>
                                                        <span className="block text-[10px] uppercase font-bold opacity-50 mb-1">English:</span>
                                                        {translatedMessages[idx]}
                                                    </span>
                                                ) : msg.content}
                                            </p>
                                        </div>
                                        {msg.date && (
                                            <span className="text-[10px] text-slate-500 mt-1 px-1">
                                                {new Date(msg.date).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

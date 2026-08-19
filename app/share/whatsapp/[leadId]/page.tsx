"use client";

import React, { useState, useEffect, use } from "react";
import {
    RefreshCw, MessageSquare, User, Bot, Link as LinkIcon,
    Check, Activity, Database, Zap, ThermometerSun
} from "lucide-react";

// ─── Parse WhatsApp activity content into messages ────────────────────────────
function parseActivityContent(content: string, summary?: string): any[] {
    if (!content) return [];
    const messages: any[] = [];
    const lines = content.split('\n');
    let seq = 0;
    let lastMessageKey = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('Template: ')) {
            const text = line.substring('Template: '.length).trim();
            messages.push({ type: 'bot', content: text, label: 'Agent', date: null, sequence: ++seq });
            lastMessageKey = 'bot';
            continue;
        }

        if (line.startsWith('User: ')) {
            const text = line.substring('User: '.length).trim();
            const key = `user:${text}`;
            if (key === lastMessageKey) continue;
            messages.push({ type: 'user', content: text, label: 'User', date: null, sequence: ++seq });
            lastMessageKey = key;
            continue;
        }

        if (line.startsWith('Agent : ') || line.startsWith('Agent: ')) {
            const text = line.replace(/^Agent\s*:\s*/, '').trim();
            messages.push({ type: 'bot', content: text, label: 'Agent', date: null, sequence: ++seq });
            lastMessageKey = `bot:${text}`;
            continue;
        }

        const tsMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4}),\s*(\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM))/i);
        if (tsMatch) {
            const dateStr = `${tsMatch[1]} ${tsMatch[2]}`;
            const [m, d, y] = dateStr.split(/[\/\s,]+/);
            const timeStr = dateStr.match(/\d{1,2}:\d{2}:\d{2}\s*(?:AM|PM)/i)?.[0] || '';
            const parsed = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${timeStr}`);
            if (!isNaN(parsed.getTime()) && messages.length > 0) {
                messages[messages.length - 1].date = parsed.toISOString();
            }
            continue;
        }

        if (messages.length > 0) {
            messages[messages.length - 1].content += '\n' + line;
        }
    }
    return messages;
}

// ─── Status badge color helper ────────────────────────────────────────────────
function getStatusStyle(status: string) {
    const s = (status || '').toLowerCase();
    if (s === 'failed' || s === 'error' || s === 'undelivered') return 'bg-red-500/10 text-red-400 border border-red-500/20';
    if (s === 'delivered' || s === 'completed') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    if (s === 'replied' || s === 'reply') return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
    if (s === 'sent') return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    return 'bg-white/5 text-slate-400 border border-white/10';
}

function getTempStyle(temp: string) {
    const t = (temp || '').toLowerCase();
    if (t.includes('hot')) return 'bg-red-500/10 text-red-400 border border-red-500/20';
    if (t.includes('warm')) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    if (t.includes('cold')) return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    return 'bg-white/5 text-slate-400 border border-white/10';
}

export default function PublicWhatsAppSharePage({ params }: { params: Promise<{ leadId: string }> }) {
    const { leadId } = use(params);
    const decodedLeadId = decodeURIComponent(leadId || '');

    const [lead, setLead] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!decodedLeadId) return;

        async function loadData() {
            setLoading(true);
            setError(null);

            const isEmail = decodedLeadId.includes('@');
            const query = isEmail
                ? `channel=whatsapp&email=${encodeURIComponent(decodedLeadId)}`
                : `channel=whatsapp&phone=${encodeURIComponent(decodedLeadId)}`;

            try {
                const res = await fetch(`/api/public/share?${query}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' },
                });

                if (!res.ok) {
                    setError('Failed to load conversation data.');
                    setLoading(false);
                    return;
                }

                const data = await res.json();
                setLead(data.lead || { name: decodedLeadId, phone: decodedLeadId });

                const allMessages: any[] = [];
                for (const act of (data.activities || [])) {
                    if (act.content) {
                        const parsed = parseActivityContent(act.content, act.summary);
                        parsed.forEach(m => {
                            if (!m.date && act.created_at) m.date = act.created_at;
                        });
                        allMessages.push(...parsed);
                    }
                }
                setMessages(allMessages);
            } catch (e) {
                setError('Network error loading conversation.');
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

    const incoming = messages.filter(m => m.type === 'user').length;
    const outgoing = messages.filter(m => m.type === 'bot').length;

    return (
        <div className="h-screen max-h-screen bg-[#0a0d14] text-white flex flex-col items-center justify-center p-3 md:p-6 relative overflow-hidden">
            <div className="fixed -top-40 -left-40 w-96 h-96 rounded-full bg-emerald-600/20 blur-[120px] pointer-events-none z-0" />
            <div className="fixed -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[120px] pointer-events-none z-0" />

            <div className="w-full max-w-6xl h-[85vh] max-h-[800px] bg-[#0d121f]/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl p-4 sm:p-5 flex flex-col relative z-10 overflow-hidden">

                {/* ── Top Bar ── */}
                <div className="mb-3 flex items-center justify-between shrink-0 flex-wrap gap-2">
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full font-semibold">
                        📱 WhatsApp Conversation • {decodedLeadId}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopyLink}
                            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase rounded-lg px-3 py-1.5 transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                        >
                            {copied ? <Check className="h-3 w-3" /> : <LinkIcon className="h-3 w-3" />}
                            {copied ? 'Copied!' : 'Copy Link'}
                        </button>
                    </div>
                </div>

                {/* ── Main Grid: Chat + Sidebar ── */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden min-h-0">

                    {/* ── Chat Timeline (2/3 width) ── */}
                    <div className="lg:col-span-2 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] h-full min-h-0">
                        <div className="border-b border-white/10 p-3 px-4 flex justify-between items-center shrink-0">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conversation Timeline</h3>
                            <div className="text-[10px] text-slate-500 font-bold">{messages.length} Messages</div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                            {loading ? (
                                <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
                                    <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                                    <p className="text-sm font-medium">Loading conversation…</p>
                                </div>
                            ) : error ? (
                                <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
                                    <MessageSquare className="h-10 w-10 opacity-20" />
                                    <p className="text-sm">{error}</p>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
                                    <MessageSquare className="h-10 w-10 opacity-20" />
                                    <p className="text-sm">No WhatsApp messages found for this contact.</p>
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div key={idx} className={`flex flex-col ${msg.type === 'user' ? 'items-start' : 'items-end'}`}>
                                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md text-sm leading-relaxed ${msg.type === 'user'
                                            ? 'bg-[#1a2035] text-white border border-white/10 rounded-tl-none'
                                            : 'bg-emerald-600 text-white rounded-tr-none'}`}
                                        >
                                            <p className={`text-[10px] font-bold uppercase mb-1 ${msg.type === 'user' ? 'text-slate-400' : 'text-emerald-100'}`}>
                                                {msg.type === 'user'
                                                    ? <span className="flex items-center gap-1"><User className="h-3 w-3" />Contact</span>
                                                    : <span className="flex items-center gap-1"><Bot className="h-3 w-3" />Agent</span>}
                                            </p>
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                        </div>
                                        {msg.date && (
                                            <span className="text-[10px] text-slate-500 mt-1 px-1">
                                                {new Date(msg.date).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* ── Right Sidebar (1/3 width) ── */}
                    <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pb-2">

                        {/* Lead Information Card */}
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                                <User className="h-4 w-4 text-slate-400" /> Lead Information
                            </h3>

                            {loading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-8 rounded-lg bg-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : lead ? (
                                <div className="space-y-4 text-sm">

                                    {/* Contact Info */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Info</p>
                                        <p className="font-medium text-white">{lead.phone || decodedLeadId}</p>
                                        {lead.email && <p className="text-xs text-slate-400 mt-0.5">{lead.email}</p>}
                                    </div>

                                    {/* Status */}
                                    {lead.status && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</p>
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusStyle(lead.status)}`}>
                                                {lead.status}
                                            </span>
                                        </div>
                                    )}

                                    {/* Source Table */}
                                    {lead.source_table && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Source Table</p>
                                            <p className="text-xs font-bold text-blue-400 flex items-center gap-1">
                                                <Database className="h-3 w-3" />
                                                {lead.source_table}
                                            </p>
                                        </div>
                                    )}

                                    {/* Action Type */}
                                    {lead.action_type && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Action Type</p>
                                            <p className="text-xs font-bold text-purple-400 flex items-center gap-1">
                                                <Zap className="h-3 w-3" />
                                                {lead.action_type}
                                            </p>
                                        </div>
                                    )}

                                    {/* Lead Temperature */}
                                    {lead.lead_temp && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Lead Temperature</p>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getTempStyle(lead.lead_temp)}`}>
                                                <ThermometerSun className="h-3 w-3" />
                                                {lead.lead_temp}
                                            </span>
                                        </div>
                                    )}

                                    {/* Summary */}
                                    {lead.summary && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Summary</p>
                                            <p className="text-xs text-slate-400 leading-relaxed">{lead.summary}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">No lead data found.</p>
                            )}
                        </div>

                        {/* Activity Stats Card */}
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                                <Activity className="h-4 w-4 text-slate-400" /> Activity Stats
                            </h3>
                            <div className="space-y-2">
                                {[
                                    { label: 'Total Messages', value: messages.length, icon: MessageSquare, color: 'text-white' },
                                    { label: 'Incoming', value: incoming, icon: User, color: 'text-emerald-400' },
                                    { label: 'Outgoing', value: outgoing, icon: Bot, color: 'text-blue-400' },
                                ].map(({ label, value, icon: Icon, color }) => (
                                    <div key={label} className="flex items-center justify-between p-2.5 px-3 rounded-lg bg-white/5 border border-white/[0.06]">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Icon className="h-3.5 w-3.5" />
                                            <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
                                        </div>
                                        <span className={`text-sm font-bold ${color}`}>{loading ? '—' : value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

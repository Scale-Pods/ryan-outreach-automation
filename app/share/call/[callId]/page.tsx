"use client";

import React, { useState, useEffect, useRef, useCallback, use } from "react";
import {
    Phone, Play, Pause, Volume2, VolumeX, Clock, Calendar,
    User, Bot, Link as LinkIcon, Check, Copy, Download,
    Activity, Database, Zap, ThermometerSun, FileText,
    ArrowRight, RefreshCw, AlertCircle
} from "lucide-react";

// ─── Status & Temperature badge color helpers ─────────────────────────────────
function getStatusStyle(status: string) {
    const s = (status || '').toLowerCase();
    if (s === 'failed' || s === 'error' || s === 'canceled' || s === 'no-answer') {
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
    }
    if (s === 'completed' || s === 'done' || s === 'ended' || s === 'answered' || s === 'success') {
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
    if (s === 'in-progress' || s === 'ringing' || s === 'queued') {
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    }
    return 'bg-white/5 text-slate-400 border border-white/10';
}

function getTempStyle(temp: string) {
    const t = (temp || '').toLowerCase();
    if (t.includes('hot')) return 'bg-red-500/10 text-red-400 border border-red-500/20';
    if (t.includes('warm')) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    if (t.includes('cold')) return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    return 'bg-white/5 text-slate-400 border border-white/10';
}

function formatDurationSeconds(dur: number): string {
    const s = Math.round(dur || 0);
    if (s >= 3600) {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${h}h ${m}m ${sec}s`;
    }
    if (s >= 60) {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}m ${sec}s`;
    }
    return `${s}s`;
}

// ─── Modern Audio Player Component ───────────────────────────────────────────
function PublicAudioPlayer({ audioUrl, titleText, initialDuration = 0 }: {
    audioUrl: string;
    titleText?: string | null;
    initialDuration?: number;
}) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const seekRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(initialDuration);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [speed, setSpeed] = useState(1);
    const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

    const proxySrc = audioUrl && audioUrl.startsWith('http')
        ? `/api/audio-proxy?url=${encodeURIComponent(audioUrl)}`
        : audioUrl;

    useEffect(() => {
        if (initialDuration > 0 && duration === 0) {
            setDuration(initialDuration);
        }
    }, [initialDuration, duration]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onLoadedMeta = () => {
            if (isFinite(audio.duration) && audio.duration > 0) {
                setDuration(audio.duration);
            }
        };
        const onTime = () => setCurrentTime(audio.currentTime);
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener('loadedmetadata', onLoadedMeta);
        audio.addEventListener('durationchange', onLoadedMeta);
        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('loadedmetadata', onLoadedMeta);
            audio.removeEventListener('durationchange', onLoadedMeta);
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
        };
    }, []);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(() => { });
        }
    };

    const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        const bar = seekRef.current;
        if (!audio || !bar || !isFinite(duration) || duration <= 0) return;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const newTime = ratio * duration;
        if (isFinite(newTime)) {
            audio.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const skip = (seconds: number) => {
        const audio = audioRef.current;
        if (!audio || !isFinite(duration) || duration <= 0) return;
        const newTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const changeSpeed = () => {
        const audio = audioRef.current;
        if (!audio) return;
        const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
        audio.playbackRate = next;
        setSpeed(next);
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isMuted) {
            audio.volume = volume || 1;
            audio.muted = false;
            setIsMuted(false);
        } else {
            audio.muted = true;
            setIsMuted(true);
        }
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setVolume(val);
        if (audioRef.current) audioRef.current.volume = val;
        setIsMuted(val === 0);
    };

    const handleDownload = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            const res = await fetch(proxySrc);
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = blobUrl;
            a.download = `call-recording-${Date.now()}.mp3`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(a);
                setIsDownloading(false);
            }, 100);
        } catch {
            window.open(audioUrl, '_blank');
            setIsDownloading(false);
        }
    };

    const formatTime = (secs: number) => {
        if (!isFinite(secs) || isNaN(secs)) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const progressPct = (isFinite(duration) && duration > 0) ? (currentTime / duration) * 100 : 0;
    const volPct = (isMuted ? 0 : volume) * 100;

    return (
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.04] mb-4">
            <audio ref={audioRef} src={proxySrc} preload="metadata" style={{ display: 'none' }} />

            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-500/20 text-blue-400">
                        <Volume2 className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Call Audio Recording</h4>
                            {titleText && (
                                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-mono font-semibold">
                                    {titleText}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400">Listen to high-fidelity call recording</p>
                    </div>
                </div>

                <button
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold uppercase tracking-wider transition-all border border-white/10"
                    title="Download audio"
                >
                    <Download className={`h-3 w-3 ${isDownloading ? 'animate-bounce' : ''}`} />
                    {isDownloading ? 'Downloading...' : 'Download'}
                </button>
            </div>

            {/* Seek Bar */}
            <div
                ref={seekRef}
                className="relative h-2 w-full rounded-full bg-white/10 cursor-pointer mb-2 group"
                onClick={handleSeekClick}
            >
                <div
                    className="absolute top-0 left-0 h-full rounded-full bg-blue-500"
                    style={{ width: `${progressPct}%` }}
                />
                <div
                    className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${progressPct}% - 7px)` }}
                />
            </div>

            {/* Time */}
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-3">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => skip(-10)}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold transition-all"
                        title="Back 10s"
                    >
                        -10s
                    </button>
                    <button
                        onClick={togglePlay}
                        className="h-9 w-9 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition-all active:scale-95"
                        title={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                    </button>
                    <button
                        onClick={() => skip(10)}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold transition-all"
                        title="Forward 10s"
                    >
                        +10s
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={changeSpeed}
                        className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold transition-all min-w-[40px] text-center"
                        title="Playback speed"
                    >
                        {speed === 1 ? '1x' : `${speed}x`}
                    </button>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={toggleMute}
                            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 transition-all"
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolume}
                            className="w-16 h-1 rounded-lg cursor-pointer accent-blue-500 bg-white/20"
                            title="Volume"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Public Call Share Page ──────────────────────────────────────────────
export default function PublicCallSharePage({ params }: { params: Promise<{ callId: string }> }) {
    const { callId } = use(params);
    const decodedCallId = decodeURIComponent(callId || '').trim();

    const [call, setCall] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedTranscript, setCopiedTranscript] = useState(false);

    useEffect(() => {
        if (!decodedCallId) return;

        async function loadCallData() {
            setLoading(true);
            setError(null);

            try {
                // Fetch public call endpoint
                const res = await fetch(`/api/public/call/${encodeURIComponent(decodedCallId)}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' },
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data && data.call) {
                        setCall(data.call);
                        setLoading(false);
                        return;
                    }
                }

                // Fallback attempt: query /api/public/share?channel=voice&callId=...
                const fallbackRes = await fetch(`/api/public/share?channel=voice&callId=${encodeURIComponent(decodedCallId)}`, {
                    cache: 'no-store',
                    headers: { 'Cache-Control': 'no-cache' },
                });

                if (fallbackRes.ok) {
                    const fallbackData = await fallbackRes.json();
                    if (fallbackData.activities && fallbackData.activities.length > 0) {
                        const act = fallbackData.activities[0];
                        setCall({
                            id: act.vapi_call_id || act.id,
                            name: act.lead_name || fallbackData.lead?.name || 'Guest',
                            phone: act.lead_phone || fallbackData.lead?.phone || 'Unknown',
                            status: act.status || 'ended',
                            type: act.action_type?.toLowerCase().includes('inbound') ? 'Inbound' : 'Outbound',
                            isInbound: act.action_type?.toLowerCase().includes('inbound') || false,
                            startedAt: act.created_at,
                            durationSeconds: act.duration_seconds || 0,
                            cost: act.cost_usd ? `$${act.cost_usd.toFixed(3)}` : '$0.00',
                            recordingUrl: act.recording_url,
                            audioUrl: act.recording_url,
                            summary: act.summary || act.note,
                            transcript: act.transcript || act.content,
                            leadTemp: act.lead_temp || act.lead_temperature || 'Unknown',
                            sourceTable: act._source_table || 'fello_activity',
                            messages: [],
                        });
                        setLoading(false);
                        return;
                    }
                }

                setError('Call details could not be found or have expired.');
            } catch (err) {
                console.error('Error loading call details:', err);
                setError('Failed to load call details. Please try again.');
            } finally {
                setLoading(false);
            }
        }

        loadCallData();
    }, [decodedCallId]);

    const handleCopyLink = () => {
        const url = window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
            });
        } else {
            const ta = document.createElement('textarea');
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand('copy');
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
            } catch { }
            document.body.removeChild(ta);
        }
    };

    const handleCopyTranscript = () => {
        if (!call) return;
        const header = `=== Call Transcript ===\nLead: ${call.name} (${call.phone})\nDate: ${new Date(call.startedAt).toLocaleString()}\nDuration: ${formatDurationSeconds(call.durationSeconds)}\n\n`;

        let body = '';
        if (Array.isArray(call.messages) && call.messages.length > 0) {
            body = call.messages
                .map((m: any) => `${m.role === 'assistant' ? 'AI' : 'User'}: ${m.message}`)
                .join('\n\n');
        } else if (call.transcript) {
            body = call.transcript;
        }

        const fullText = header + body;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(fullText).then(() => {
                setCopiedTranscript(true);
                setTimeout(() => setCopiedTranscript(false), 2000);
            });
        }
    };

    const leadName = call?.name || decodedCallId;
    const phoneDisplay = call?.phone || call?.customer_number || 'Unknown';
    const isInbound = call?.isInbound || call?.type?.toLowerCase() === 'inbound';
    const messages = Array.isArray(call?.messages) ? call.messages : [];

    const userTurns = messages.filter((m: any) => m.role === 'user').length;
    const botTurns = messages.filter((m: any) => m.role === 'assistant').length;

    return (
        <div className="h-screen max-h-screen bg-[#0a0d14] text-white flex flex-col items-center justify-center p-3 md:p-6 relative overflow-hidden">
            {/* Ambient glowing orbs */}
            <div className="fixed -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600/20 blur-[120px] pointer-events-none z-0" />
            <div className="fixed -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-purple-600/15 blur-[120px] pointer-events-none z-0" />

            <div className="w-full max-w-6xl h-[85vh] max-h-[820px] bg-[#0d121f]/90 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl p-4 sm:p-5 flex flex-col relative z-10 overflow-hidden">

                {/* ── Top Bar ── */}
                <div className="mb-3 flex items-center justify-between shrink-0 flex-wrap gap-2">
                    <span className="text-xs font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-blue-400" /> Voice Call Log • {leadName}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopyLink}
                            className={`flex items-center gap-1.5 text-[10px] font-bold uppercase rounded-lg px-3 py-1.5 transition-all ${copiedLink ? 'bg-emerald-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                                }`}
                        >
                            {copiedLink ? <Check className="h-3 w-3" /> : <LinkIcon className="h-3 w-3" />}
                            {copiedLink ? 'Copied!' : 'Copy Link'}
                        </button>
                    </div>
                </div>

                {/* ── Main Grid ── */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden min-h-0">

                    {/* ── Left Column: Audio & Transcript (2/3 width) ── */}
                    <div className="lg:col-span-2 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] h-full min-h-0 p-4">

                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                                <p className="text-sm font-medium">Loading call details & transcript...</p>
                            </div>
                        ) : error ? (
                            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                                <AlertCircle className="h-10 w-10 text-amber-500/60" />
                                <p className="text-sm">{error}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full min-h-0 overflow-hidden">

                                {/* Audio Player if available */}
                                {(call.audioUrl || call.recordingUrl) && (
                                    <PublicAudioPlayer
                                        audioUrl={call.audioUrl || call.recordingUrl}
                                        titleText={call.callOrderTitle}
                                        initialDuration={call.durationSeconds}
                                    />
                                )}

                                {/* Call Summary card if available */}
                                {call.summary && (
                                    <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] mb-4 shrink-0 max-h-36 overflow-y-auto">
                                        <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-white uppercase tracking-wider">
                                            <FileText className="h-3.5 w-3.5 text-blue-400" /> Call Summary & Notes
                                        </div>
                                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                                            {call.summary}
                                        </p>
                                    </div>
                                )}

                                {/* Transcript Timeline */}
                                <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-white/10 bg-black/20 overflow-hidden">
                                    <div className="border-b border-white/10 p-2.5 px-3.5 flex justify-between items-center shrink-0 bg-white/[0.02]">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>Conversation Transcript</span>
                                            {messages.length > 0 && (
                                                <span className="text-[10px] text-slate-500 font-mono">({messages.length} turns)</span>
                                            )}
                                        </h3>
                                        <button
                                            onClick={handleCopyTranscript}
                                            className="text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors uppercase"
                                        >
                                            {copiedTranscript ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                            {copiedTranscript ? 'Copied' : 'Copy'}
                                        </button>
                                    </div>

                                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0">
                                        {messages.length > 0 ? (
                                            messages.map((msg: any, idx: number) => {
                                                const isAssistant = msg.role === 'assistant';
                                                return (
                                                    <div key={idx} className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}>
                                                        <div
                                                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-md text-sm leading-relaxed ${isAssistant
                                                                ? 'bg-[#182033] text-white border border-white/10 rounded-tl-none'
                                                                : 'bg-blue-600 text-white rounded-tr-none'
                                                                }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3 mb-1">
                                                                <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${isAssistant ? 'text-indigo-300' : 'text-blue-100'
                                                                    }`}>
                                                                    {isAssistant ? (
                                                                        <>
                                                                            <Bot className="h-3 w-3" />
                                                                            {call.assistantName || 'AI Assistant'}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <User className="h-3 w-3" />
                                                                            {call.name || 'Caller'}
                                                                        </>
                                                                    )}
                                                                </span>
                                                                {msg.startTime !== undefined && (
                                                                    <span className="text-[9px] font-mono opacity-70">
                                                                        {Math.floor(msg.startTime / 60)}:{(Math.floor(msg.startTime % 60)).toString().padStart(2, '0')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="whitespace-pre-wrap text-[13px]">{msg.message}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : call.transcript ? (
                                            <div className="p-3 bg-white/[0.02] rounded-lg text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                                                {call.transcript}
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12">
                                                <Phone className="h-8 w-8 opacity-20 mb-2" />
                                                <p className="text-xs">No transcript recording found for this call.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>
                        )}
                    </div>

                    {/* ── Right Column: Call Metadata (1/3 width) ── */}
                    <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto pb-2">

                        {/* Call Information Card */}
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                                <Phone className="h-4 w-4 text-blue-400" /> Call Details
                            </h3>

                            {loading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-8 rounded-lg bg-white/5 animate-pulse" />
                                    ))}
                                </div>
                            ) : call ? (
                                <div className="space-y-3.5 text-sm">

                                    {/* Caller / Guest Info */}
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Caller / Guest</p>
                                        <p className="font-semibold text-white">{call.name || 'Guest'}</p>
                                        <p className="text-xs text-slate-400 font-mono mt-0.5">{phoneDisplay}</p>
                                    </div>

                                    {/* Direction & Status */}
                                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Direction</p>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${isInbound
                                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                                }`}>
                                                {isInbound ? 'Inbound' : 'Outbound'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</p>
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusStyle(call.status)}`}>
                                                {call.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Date & Time */}
                                    <div className="pt-1 border-t border-white/[0.06]">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Date & Time</p>
                                        <p className="text-xs font-mono text-slate-300">
                                            {call.startedAt ? new Date(call.startedAt).toLocaleString([], {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                second: '2-digit',
                                            }) : '—'}
                                        </p>
                                    </div>

                                    {/* Duration */}
                                    <div className="pt-1 border-t border-white/[0.06]">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Duration</p>
                                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5 text-blue-400" />
                                            {formatDurationSeconds(call.durationSeconds)}
                                        </p>
                                    </div>

                                    {/* Assistant / Line */}
                                    {call.assistantName && (
                                        <div className="pt-1 border-t border-white/[0.06]">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">AI Agent</p>
                                            <p className="text-xs font-semibold text-indigo-300 flex items-center gap-1">
                                                <Bot className="h-3 w-3" />
                                                {call.assistantName}
                                            </p>
                                            {call.phoneNumber && call.phoneNumber !== 'Unknown' && (
                                                <p className="text-[11px] text-slate-400 font-mono mt-0.5">Line: +{String(call.phoneNumber).replace(/\D/g, '')}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Temperature */}
                                    {call.leadTemp && call.leadTemp !== 'Unknown' && (
                                        <div className="pt-1 border-t border-white/[0.06]">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Lead Temperature</p>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getTempStyle(call.leadTemp)}`}>
                                                <ThermometerSun className="h-3 w-3" />
                                                {call.leadTemp}
                                            </span>
                                        </div>
                                    )}

                                    {/* Source / Campaign */}
                                    {(call.sourceTable || call.campaign) && (
                                        <div className="pt-1 border-t border-white/[0.06]">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Source / Loop</p>
                                            <p className="text-xs text-blue-400 flex items-center gap-1">
                                                <Database className="h-3 w-3" />
                                                {call.campaign || call.sourceTable}
                                            </p>
                                        </div>
                                    )}

                                </div>
                            ) : null}
                        </div>

                        {/* Activity & Stats Card */}
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                <Activity className="h-4 w-4 text-emerald-400" /> Call Metrics
                            </h3>
                            <div className="space-y-2">
                                {[
                                    { label: 'Total Duration', value: loading ? '—' : formatDurationSeconds(call?.durationSeconds || 0), icon: Clock, color: 'text-white' },
                                    { label: 'Total Turns', value: loading ? '—' : messages.length, icon: Phone, color: 'text-blue-400' },
                                    { label: 'AI Turns', value: loading ? '—' : botTurns, icon: Bot, color: 'text-indigo-400' },
                                    { label: 'User Turns', value: loading ? '—' : userTurns, icon: User, color: 'text-emerald-400' },
                                    { label: 'Cost', value: loading ? '—' : (call?.cost || '$0.00'), icon: Zap, color: 'text-amber-400' },
                                ].map(({ label, value, icon: Icon, color }) => (
                                    <div key={label} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/[0.06]">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Icon className="h-3 w-3" />
                                            <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
                                        </div>
                                        <span className={`text-xs font-bold ${color}`}>{value}</span>
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


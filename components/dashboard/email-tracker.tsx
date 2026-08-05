"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Mail, RefreshCw, Pencil, Check, X, Send, Shield, TrendingUp, AlertCircle
} from "lucide-react";

interface TrackerRow {
    id: number;
    created_at: string;
    email: string | null;
    total_sent: string | null;
    max_allowed: string | null;
    todays_count: string | null;
}

function getUsageColor(used: number, max: number) {
    if (max <= 0) return { bar: "bg-slate-500", text: "text-slate-400", badge: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
    const pct = (used / max) * 100;
    if (pct >= 90) return { bar: "bg-rose-500", text: "text-rose-400", badge: "bg-rose-500/10 text-rose-400 border-rose-500/20" };
    if (pct >= 70) return { bar: "bg-amber-500", text: "text-amber-400", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
    return { bar: "bg-emerald-500", text: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
}

export function EmailTrackerSection() {
    const [trackers, setTrackers] = useState<TrackerRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState<string>("");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const fetchTrackers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/email/tracker", { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setTrackers(data.trackers || []);
        } catch (e: any) {
            setError(e.message || "Failed to load email tracker data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchTrackers(); }, [fetchTrackers]);

    const startEdit = (row: TrackerRow) => {
        setEditingId(row.id);
        setEditValue(row.max_allowed || "");
        setSaveError(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValue("");
        setSaveError(null);
    };

    const saveEdit = async (id: number) => {
        if (!editValue.trim() || isNaN(Number(editValue))) {
            setSaveError("Please enter a valid number.");
            return;
        }
        setSaving(true);
        setSaveError(null);
        try {
            const res = await fetch("/api/email/tracker", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, max_allowed: editValue.trim() }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Update failed");
            }
            const updated = await res.json();
            setTrackers(prev => prev.map(t => t.id === id ? updated.tracker : t));
            setEditingId(null);
        } catch (e: any) {
            setSaveError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const totalSent = trackers.reduce((acc, t) => acc + (parseInt(t.total_sent || "0") || 0), 0);
    const totalToday = trackers.reduce((acc, t) => acc + (parseInt(t.todays_count || "0") || 0), 0);
    const totalMax = trackers.reduce((acc, t) => acc + (parseInt(t.max_allowed || "0") || 0), 0);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-[var(--separator)] bg-[var(--glass-fill)]">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <Send className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[var(--label-primary)]">{totalSent.toLocaleString()}</p>
                            <p className="text-xs text-[var(--label-secondary)] font-bold uppercase">Total Sent (All Time)</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-[var(--separator)] bg-[var(--glass-fill)]">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <TrendingUp className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[var(--label-primary)]">{totalToday.toLocaleString()}</p>
                            <p className="text-xs text-[var(--label-secondary)] font-bold uppercase">Sent Today</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-[var(--separator)] bg-[var(--glass-fill)]">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <Shield className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[var(--label-primary)]">{totalMax.toLocaleString()}</p>
                            <p className="text-xs text-[var(--label-secondary)] font-bold uppercase">Total Daily Limit</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tracker Table */}
            <Card className="border-[var(--separator)] bg-[var(--glass-fill)]">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Mail className="h-4 w-4 text-blue-400" />
                                Email Account Tracker
                            </CardTitle>
                            <CardDescription>Monitor sending limits and daily usage per email account. Click the pencil icon to update the max allowed limit.</CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchTrackers}
                            disabled={loading}
                            className="gap-2 text-[var(--label-secondary)] hover:text-[var(--label-primary)]"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {error ? (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <p className="text-sm">{error}</p>
                        </div>
                    ) : loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
                            ))}
                        </div>
                    ) : trackers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-[var(--label-tertiary)]">
                            <Mail className="h-10 w-10 opacity-20" />
                            <p className="text-sm">No email accounts tracked yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {trackers.map(row => {
                                const todayNum = parseInt(row.todays_count || "0") || 0;
                                const maxNum = parseInt(row.max_allowed || "0") || 0;
                                const totalNum = parseInt(row.total_sent || "0") || 0;
                                const pct = maxNum > 0 ? Math.min(100, (todayNum / maxNum) * 100) : 0;
                                const colors = getUsageColor(todayNum, maxNum);
                                const isEditing = editingId === row.id;

                                return (
                                    <div
                                        key={row.id}
                                        className="p-4 rounded-xl border border-[var(--separator)] bg-[var(--bg-app)] hover:bg-white/[0.03] transition-all"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                            {/* Email */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Mail className="h-3.5 w-3.5 text-[var(--label-tertiary)] shrink-0" />
                                                    <p className="text-sm font-bold text-[var(--label-primary)] truncate">
                                                        {row.email || "—"}
                                                    </p>
                                                </div>
                                                {/* Progress Bar */}
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-[var(--fill-tertiary)] rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-[10px] font-bold ${colors.text}`}>
                                                        {pct.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Stats */}
                                            <div className="flex items-center gap-4 shrink-0 flex-wrap">
                                                <div className="text-center">
                                                    <p className="text-[10px] font-bold uppercase text-[var(--label-tertiary)]">Total Sent</p>
                                                    <p className="text-sm font-bold text-[var(--label-primary)]">{totalNum.toLocaleString()}</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] font-bold uppercase text-[var(--label-tertiary)]">Today</p>
                                                    <p className={`text-sm font-bold ${colors.text}`}>{todayNum}</p>
                                                </div>

                                                {/* Max Allowed (editable) */}
                                                <div className="text-center">
                                                    <p className="text-[10px] font-bold uppercase text-[var(--label-tertiary)] mb-1">Max/Day</p>
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                value={editValue}
                                                                onChange={e => setEditValue(e.target.value)}
                                                                className="w-20 text-center text-sm font-bold bg-[var(--glass-fill)] border border-blue-500/40 rounded-lg px-2 py-1 text-[var(--label-primary)] focus:outline-none focus:border-blue-500"
                                                                autoFocus
                                                                onKeyDown={e => {
                                                                    if (e.key === "Enter") saveEdit(row.id);
                                                                    if (e.key === "Escape") cancelEdit();
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => saveEdit(row.id)}
                                                                disabled={saving}
                                                                className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
                                                            >
                                                                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-[var(--label-secondary)] transition-all"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <Badge className={`text-[10px] font-bold border px-2 py-0.5 ${colors.badge}`}>
                                                                {maxNum > 0 ? maxNum : "—"}
                                                            </Badge>
                                                            <button
                                                                onClick={() => startEdit(row)}
                                                                className="p-1 rounded-lg hover:bg-white/10 text-[var(--label-tertiary)] hover:text-blue-400 transition-all"
                                                                title="Edit max allowed"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Inline save error */}
                                        {isEditing && saveError && (
                                            <p className="text-xs text-rose-400 mt-2 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" /> {saveError}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

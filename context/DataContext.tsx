"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { consolidateLeads, ConsolidatedLead } from "@/lib/leads-utils";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { useRouter } from 'next/navigation';
import { logout } from '@/app/actions/auth';

export interface MasterMetrics {
    totalLeads: number;
    oldestLeadDate: string | null;
    totalWaReachouts: number;
    totalWaReplies: number;
    totalVoiceCalls: number;
    ownerVoiceCalls: number;
    normalVapiCost: number;
    ownerVapiCost: number;
    leadsDaily: { date: string; leads: number }[];
    ownerWaReachouts: number;
    ownerWaReplies: number;
}

export interface WhatsappMetrics {
    totalReachouts: number;
    totalReplies: number;
    replyRate: number;
    dailyTrend: { date: string; reachouts: number; replies: number }[];
    ownerReachouts: number;
    ownerReplies: number;
}

export interface VoiceMetrics {
    totalCalls: number;
    totalDuration: number;
    avgDuration: number;
    totalCost: number;
    avgCost: number;
    completedCalls: number;
    answeredCalls: number;
    successRate: number;
    normalCalls: number;
    ownerCalls: number;
    normalConnected: number;
    normalQualified: number;
    normalPickupRate: number;
    normalCompletionRate: number;
    normalPositiveCount: number;
    normalPositiveRate: number;
    ownerConnected: number;
    ownerQualified: number;
    ownerPickupRate: number;
    ownerCompletionRate: number;
    ownerPositiveCount: number;
    ownerPositiveRate: number;
    allTimeNormalCalls: number;
    allTimeOwnerCalls: number;
    dailyVolume: { date: string; calls: number; cost: number }[];
    hourlyDistribution: { hour: number; calls: number }[];
    durationBuckets: { label: string; calls: number }[];
    costByDay: { date: string; calls: number; cost: number }[];
}

interface DataContextType {
    leads: ConsolidatedLead[];
    calls: any[];
    allTimeVoiceCount: number;
    allTimeOwnerVoiceCount: number;
    loadingLeads: boolean;
    loadingCalls: boolean;
    loadingBalances: boolean;
    loadingVoiceMetrics: boolean;
    loadingMasterMetrics: boolean;
    loadingWhatsappMetrics: boolean;
    voiceMetrics: VoiceMetrics | null;
    masterMetrics: MasterMetrics | null;
    whatsappMetrics: WhatsappMetrics | null;
    voiceBalance: any;
    twilioBalance: any;
    error: string | null;
    refreshLeads: (params?: { from?: Date; to?: Date; force?: boolean }) => Promise<void>;
    refreshCalls: (params?: { from?: Date; to?: Date; provider?: string; force?: boolean; account?: string; status?: string; type?: string; phone?: string; leadTemp?: string; sort?: string; page?: number; limit?: number }) => Promise<void>;
    refreshBalances: () => Promise<void>;
    refreshVoiceMetrics: (params?: { from?: Date; to?: Date; force?: boolean }) => Promise<void>;
    refreshMasterMetrics: (params?: { from?: Date; to?: Date; force?: boolean }) => Promise<void>;
    refreshWhatsappMetrics: (params?: { from?: Date; to?: Date; force?: boolean }) => Promise<void>;
    refreshAll: (params?: { from?: Date; to?: Date }) => Promise<void>;
    computeWPReplies: (dateRange?: { from?: Date; to?: Date } | null) => number;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [leads, setLeads] = useState<ConsolidatedLead[]>([]);
    const [calls, setCalls] = useState<any[]>([]);
    const [allTimeVoiceCount, setAllTimeVoiceCount] = useState(0);
    const [allTimeOwnerVoiceCount, setAllTimeOwnerVoiceCount] = useState(0);
    const [loadingLeads, setLoadingLeads] = useState(true);
    const [loadingCalls, setLoadingCalls] = useState(true);
    const [loadingBalances, setLoadingBalances] = useState(true);
    const [loadingVoiceMetrics, setLoadingVoiceMetrics] = useState(true);
    const [loadingMasterMetrics, setLoadingMasterMetrics] = useState(true);
    const [loadingWhatsappMetrics, setLoadingWhatsappMetrics] = useState(true);
    const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
    const [masterMetrics, setMasterMetrics] = useState<MasterMetrics | null>(null);
    const [whatsappMetrics, setWhatsappMetrics] = useState<WhatsappMetrics | null>(null);
    const [voiceBalance, setVoiceBalance] = useState<any>(null);
    const [twilioBalance, setTwilioBalance] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Gatekeepers to prevent redundant identical calls
    const lastCallParams = useRef<string | null>(null);
    const lastVoiceMetricsParams = useRef<string | null>(null);

    const fetchLeads = useCallback(async (params?: { from?: Date; to?: Date; force?: boolean }) => {
        setLoadingLeads(true);
        try {
            const now = new Date();
            const fromDate = params?.from ? startOfDay(params.from) : subDays(startOfDay(now), 7);
            const toDate = params?.to ? endOfDay(params.to) : endOfDay(now);

            const query = new URLSearchParams({
                from: fromDate.toISOString(),
                to: toDate.toISOString()
            });

            const response = await fetch(`/api/leads?${query.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch leads');
            const data = await response.json();
            const consolidated = consolidateLeads(data);
            setLeads(consolidated);
        } catch (err: any) {
            console.error('DataProvider leads fetch error:', err);
            setError(err.message);
        } finally {
            setLoadingLeads(false);
        }
    }, []);

    const fetchCalls = useCallback(async (params?: {
        from?: Date; to?: Date; provider?: string; force?: boolean;
        account?: string; status?: string; type?: string;
        phone?: string; leadTemp?: string; sort?: string;
        page?: number; limit?: number;
    }) => {
        try {
            const now = new Date();
            const fromDate = params?.from ? startOfDay(params.from) : subDays(startOfDay(now), 7);
            const toDate = params?.to ? endOfDay(params.to) : endOfDay(now);

            if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                console.error("Invalid dates passed to fetchCalls");
                return;
            }

            const query = new URLSearchParams();
            query.set('from', fromDate.toISOString());
            query.set('to', toDate.toISOString());
            if (params?.account) query.set('account', params.account);
            if (params?.status && params.status !== 'all') query.set('status', params.status);
            if (params?.type && params.type !== 'all') query.set('type', params.type);
            if (params?.phone) query.set('phone', params.phone);
            if (params?.leadTemp && params.leadTemp !== 'all') query.set('leadTemp', params.leadTemp);
            if (params?.sort) query.set('sort', params.sort);
            if (params?.page) query.set('page', String(params.page));
            if (params?.limit) query.set('limit', String(params.limit));

            const currentQuery = query.toString();

            if (!params?.force && lastCallParams.current === currentQuery && (calls.length > 0 || loadingCalls)) {
                return;
            }

            setLoadingCalls(true);
            lastCallParams.current = currentQuery;

            const response = await fetch(`/api/calls?${currentQuery}`);
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data.calls)) {
                    setCalls(data.calls);
                    setAllTimeVoiceCount(data.total || 0);
                }
            } else {
                lastCallParams.current = null;
            }
        } catch (err: any) {
            console.error('DataProvider calls fetch error:', err);
            lastCallParams.current = null;
        } finally {
            setLoadingCalls(false);
        }
    }, []);

    const hasVoiceMetrics = useRef(false);

    const fetchVoiceMetrics = useCallback(async (params?: { from?: Date; to?: Date; force?: boolean }) => {
        try {
            const now = new Date();
            const fromDate = params?.from ? startOfDay(params.from) : subDays(startOfDay(now), 7);
            const toDate = params?.to ? endOfDay(params.to) : endOfDay(now);

            const query = new URLSearchParams({
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
            });

            const currentQuery = query.toString();
            if (!params?.force && lastVoiceMetricsParams.current === currentQuery && hasVoiceMetrics.current) {
                return;
            }

            setLoadingVoiceMetrics(true);
            lastVoiceMetricsParams.current = currentQuery;

            const response = await fetch(`/api/metrics/voice?${currentQuery}`);
            if (response.ok) {
                const data: VoiceMetrics = await response.json();
                setVoiceMetrics(data);
                hasVoiceMetrics.current = true;
                // Keep legacy allTime counters in sync for any components still using them
                setAllTimeVoiceCount(data.allTimeNormalCalls);
                setAllTimeOwnerVoiceCount(data.allTimeOwnerCalls);
            } else {
                lastVoiceMetricsParams.current = null;
            }
        } catch (err: any) {
            console.error('DataProvider voice metrics fetch error:', err);
            lastVoiceMetricsParams.current = null;
        } finally {
            setLoadingVoiceMetrics(false);
        }
    }, []);

    const lastMasterMetricsParams = useRef<string | null>(null);
    const hasMasterMetrics = useRef(false);

    const fetchMasterMetrics = useCallback(async (params?: { from?: Date; to?: Date; force?: boolean }) => {
        try {
            const now = new Date();
            const fromDate = params?.from ? startOfDay(params.from) : subDays(startOfDay(now), 7);
            const toDate = params?.to ? endOfDay(params.to) : endOfDay(now);

            const query = new URLSearchParams({
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
            });

            const currentQuery = query.toString();
            if (!params?.force && lastMasterMetricsParams.current === currentQuery && hasMasterMetrics.current) {
                return;
            }

            setLoadingMasterMetrics(true);
            lastMasterMetricsParams.current = currentQuery;

            const response = await fetch(`/api/metrics/master?${currentQuery}`);
            if (response.ok) {
                const data: MasterMetrics = await response.json();
                setMasterMetrics(data);
                hasMasterMetrics.current = true;
            } else {
                lastMasterMetricsParams.current = null;
            }
        } catch (err: any) {
            console.error('DataProvider master metrics fetch error:', err);
            lastMasterMetricsParams.current = null;
        } finally {
            setLoadingMasterMetrics(false);
        }
    }, []);

    const lastWhatsappMetricsParams = useRef<string | null>(null);
    const hasWhatsappMetrics = useRef(false);

    const fetchWhatsappMetrics = useCallback(async (params?: { from?: Date; to?: Date; force?: boolean }) => {
        try {
            const now = new Date();
            const fromDate = params?.from ? startOfDay(params.from) : subDays(startOfDay(now), 7);
            const toDate = params?.to ? endOfDay(params.to) : endOfDay(now);

            const query = new URLSearchParams({
                from: fromDate.toISOString(),
                to: toDate.toISOString(),
            });

            const currentQuery = query.toString();
            if (!params?.force && lastWhatsappMetricsParams.current === currentQuery && hasWhatsappMetrics.current) {
                return;
            }

            setLoadingWhatsappMetrics(true);
            lastWhatsappMetricsParams.current = currentQuery;

            const response = await fetch(`/api/metrics/whatsapp?${currentQuery}`);
            if (response.ok) {
                const data: WhatsappMetrics = await response.json();
                setWhatsappMetrics(data);
                hasWhatsappMetrics.current = true;
            } else {
                lastWhatsappMetricsParams.current = null;
            }
        } catch (err: any) {
            console.error('DataProvider whatsapp metrics fetch error:', err);
            lastWhatsappMetricsParams.current = null;
        } finally {
            setLoadingWhatsappMetrics(false);
        }
    }, []);

    const fetchBalances = useCallback(async () => {
        try {
            const [vapiRes, twilioRes] = await Promise.all([
                fetch('/api/vapi/balance'),
                fetch('/api/twilio/balance')
            ]);
            if (vapiRes.ok) setVoiceBalance(await vapiRes.json());
            if (twilioRes.ok) setTwilioBalance(await twilioRes.json());
        } catch (err) { }
        finally { setLoadingBalances(false); }
    }, []);

    const refreshAll = useCallback(async (params?: { from?: Date; to?: Date }) => {
        await Promise.all([
            fetchLeads(params),
            fetchCalls(params),
            fetchBalances(),
            fetchVoiceMetrics(params),
            fetchMasterMetrics(params),
            fetchWhatsappMetrics(params),
        ]);
    }, [fetchLeads, fetchCalls, fetchBalances, fetchVoiceMetrics, fetchMasterMetrics, fetchWhatsappMetrics]);

    const router = useRouter();

    // Track whether we've already done the one-time 90-day fallback
    const didAutoExpand = useRef(false);

    // After the initial 7-day fetch completes, if we got no leads,
    // re-fetch everything with a 90-day window so pages always have data to show.
    useEffect(() => {
        if (loadingLeads || loadingMasterMetrics || loadingWhatsappMetrics) return;
        if (didAutoExpand.current) return;
        didAutoExpand.current = true;

        if (leads.length === 0) {
            const from = subDays(startOfDay(new Date()), 90);
            const to = endOfDay(new Date());
            // Only expand raw leads data — metrics are controlled per-page
            fetchLeads({ from, to });
        }
    }, [loadingLeads, loadingMasterMetrics, loadingWhatsappMetrics,
        leads, fetchLeads]);

    useEffect(() => {
        // Master Dashboard strategy: Fetch everything on mount
        refreshAll();

        // Session Monitor: Checks every 1 minute if the session is still valid
        const checkSession = async () => {
            try {
                const res = await fetch('/api/auth/session');
                if (!res.ok) {
                    // Session expired or invalid
                    await logout();
                    router.push('/');
                    router.refresh();
                }
            } catch (err) {
                console.error("Session check failed", err);
            }
        };

        const interval = setInterval(checkSession, 60000); // Check every 60 seconds
        return () => clearInterval(interval);
    }, [refreshAll, router]);

    const computeWPReplies = useCallback((dateRange?: { from?: Date; to?: Date } | null): number => {
        if (!leads) return 0;
        const fromDate = dateRange?.from ? startOfDay(new Date(dateRange.from)) : null;
        const toDate = dateRange?.to ? endOfDay(new Date(dateRange.to)) : (fromDate ? endOfDay(new Date(fromDate)) : null);

        const toYYYYMMDD = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        const isWithinRange = (d: Date | null) => {
            if (!fromDate || !toDate) return true;
            if (!d) return false;
            if (d >= fromDate && d <= toDate) return true;
            const dStr = toYYYYMMDD(d);
            return dStr >= toYYYYMMDD(fromDate) && dStr <= toYYYYMMDD(toDate);
        };

        const seen = new Set<string>();
        let count = 0;

        leads.forEach((lead: any) => {
            // Deduplicate
            const uid = lead["Lead ID"] || lead.id || lead.phone;
            if (!uid || seen.has(uid)) return;
            seen.add(uid);

            const track = lead["WP_Replied_track"];
            if (!track || String(track).trim() === "" || String(track).trim().toLowerCase() === "no") return;

            const content = String(track).trim();
            let replyDate: Date | null = null;

            // ISO regex extraction
            const isoMatch = content.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^ \n]*)/);
            if (isoMatch) {
                const d = new Date(isoMatch[1]);
                if (!isNaN(d.getTime())) replyDate = d;
            }

            // Fallback: try direct parse
            if (!replyDate) {
                const d = new Date(content);
                if (!isNaN(d.getTime()) && (content.includes('T') || (content.includes('-') && content.includes(':')))) {
                    replyDate = d;
                }
            }

            if (replyDate && isWithinRange(replyDate)) {
                count++;
            }
        });

        return count;
    }, [leads]);

    return (
        <DataContext.Provider value={{
            leads,
            calls,
            allTimeVoiceCount,
            allTimeOwnerVoiceCount,
            loadingLeads,
            loadingCalls,
            loadingBalances,
            loadingVoiceMetrics,
            loadingMasterMetrics,
            loadingWhatsappMetrics,
            voiceMetrics,
            masterMetrics,
            whatsappMetrics,
            voiceBalance,
            twilioBalance,
            error,
            refreshLeads: fetchLeads,
            refreshCalls: fetchCalls,
            refreshBalances: fetchBalances,
            refreshVoiceMetrics: fetchVoiceMetrics,
            refreshMasterMetrics: fetchMasterMetrics,
            refreshWhatsappMetrics: fetchWhatsappMetrics,
            refreshAll,
            computeWPReplies
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}

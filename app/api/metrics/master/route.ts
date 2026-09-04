import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACTIVITY_TABLES = ['fello_activity', 'aspen_activity', 'naples_activity', 'old_activity'] as const;

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
    dailyAcquisition?: { date: string; leads: number }[];
    ownerWaReachouts: number;
    ownerWaReplies: number;
    activityEmailCount?: number;
    activityWaCount?: number;
    activityVoiceCount?: number;
    activitySmsCount?: number;
    activityRepliesCount?: number;
    activityTotalCount?: number;
}

const EMPTY: MasterMetrics = {
    totalLeads: 0, oldestLeadDate: null,
    totalWaReachouts: 0, totalWaReplies: 0,
    totalVoiceCalls: 0, ownerVoiceCalls: 0,
    normalVapiCost: 0, ownerVapiCost: 0,
    leadsDaily: [],
    dailyAcquisition: [],
    ownerWaReachouts: 0, ownerWaReplies: 0,
    activityEmailCount: 0, activityWaCount: 0,
    activityVoiceCount: 0, activitySmsCount: 0,
    activityRepliesCount: 0, activityTotalCount: 0,
};

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        // 1. Aggregate activity metrics across all 4 activity tables
        let activityEmailCount = 0;
        let activityWaCount = 0;
        let activityVoiceCount = 0;
        let activitySmsCount = 0;
        let activityRepliesCount = 0;
        let activityTotalCount = 0;

        try {
            const activityPromises = ACTIVITY_TABLES.flatMap(table => [
                supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).ilike('channel', 'email').gte('created_at', fromDate).lte('created_at', toDate),
                supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).ilike('channel', 'whatsapp').gte('created_at', fromDate).lte('created_at', toDate),
                supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).ilike('channel', 'voice').gte('created_at', fromDate).lte('created_at', toDate),
                supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).ilike('channel', 'sms').gte('created_at', fromDate).lte('created_at', toDate),
                supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).or('action_type.ilike.reply,action_type.ilike.%reply%,status.ilike.replied,status.ilike.%reply%,replied_at.not.is.null,replied.ilike.yes,replied.eq.true').gte('created_at', fromDate).lte('created_at', toDate),
                supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).gte('created_at', fromDate).lte('created_at', toDate),
            ]);

            const activityResults = await Promise.all(activityPromises);

            ACTIVITY_TABLES.forEach((_, i) => {
                activityEmailCount += activityResults[i * 6]?.count || 0;
                activityWaCount += activityResults[i * 6 + 1]?.count || 0;
                activityVoiceCount += activityResults[i * 6 + 2]?.count || 0;
                activitySmsCount += activityResults[i * 6 + 3]?.count || 0;
                activityRepliesCount += activityResults[i * 6 + 4]?.count || 0;
                activityTotalCount += activityResults[i * 6 + 5]?.count || 0;
            });
        } catch (actErr) {
            console.error('Error fetching activity table metrics:', actErr);
        }

        const activityMetrics = {
            activityEmailCount,
            activityWaCount,
            activityVoiceCount,
            activitySmsCount,
            activityRepliesCount,
            activityTotalCount,
        };

        // Try RPC first
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_master_metrics', {
            p_from: fromDate,
            p_to: toDate,
        });

        if (!rpcError && rpcData) {
            return NextResponse.json({
                ...rpcData,
                ...activityMetrics,
            }, { headers: { 'Cache-Control': 'no-store' } });
        }

        // Fallback: direct queries across all activity tables
        const [leadsCount, felloLeadsCount, oldestLead, leadsDaily] = await Promise.all([
            supabaseAdmin.from('master_leads')
                .select('id', { count: 'exact', head: true }),
            supabaseAdmin.from('fello_leads')
                .select('id', { count: 'exact', head: true }),
            supabaseAdmin.from('master_leads')
                .select('created_at')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle(),
            supabaseAdmin.from('master_leads')
                .select('created_at')
                .gte('created_at', fromDate)
                .lte('created_at', toDate)
                .order('created_at', { ascending: true }),
        ]);

        let totalVoiceCallsCount = 0;
        let ownerVoiceCallsCount = 0;
        let normalCostSum = 0;
        let ownerCostSum = 0;

        for (const table of ACTIVITY_TABLES) {
            const [vc, ovc, nc, oc] = await Promise.all([
                supabaseAdmin.from(table)
                    .select('id', { count: 'exact', head: true })
                    .ilike('channel', 'voice')
                    .gte('created_at', fromDate)
                    .lte('created_at', toDate),
                supabaseAdmin.from(table)
                    .select('id', { count: 'exact', head: true })
                    .ilike('channel', 'voice')
                    .eq('vapi_account', 'owners')
                    .gte('created_at', fromDate)
                    .lte('created_at', toDate),
                supabaseAdmin.from(table)
                    .select('cost_usd')
                    .ilike('channel', 'voice')
                    .or('vapi_account.is.null,vapi_account.neq.owners')
                    .gte('created_at', fromDate)
                    .lte('created_at', toDate),
                supabaseAdmin.from(table)
                    .select('cost_usd')
                    .ilike('channel', 'voice')
                    .eq('vapi_account', 'owners')
                    .gte('created_at', fromDate)
                    .lte('created_at', toDate),
            ]);

            totalVoiceCallsCount += vc.count || 0;
            ownerVoiceCallsCount += ovc.count || 0;
            normalCostSum += (nc.data || []).reduce((s, r) => s + (r.cost_usd || 0), 0);
            ownerCostSum += (oc.data || []).reduce((s, r) => s + (r.cost_usd || 0), 0);
        }

        // Daily outreach activity and leads
        const dailyMap = new Map<string, number>();
        let curr = new Date(fromDate);
        const endD = new Date(toDate);
        while (curr <= endD) {
            const dStr = curr.toISOString().split('T')[0];
            dailyMap.set(dStr, 0);
            curr.setDate(curr.getDate() + 1);
        }

        for (const r of leadsDaily.data || []) {
            const d = r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : null;
            if (d && dailyMap.has(d)) {
                dailyMap.set(d, (dailyMap.get(d) || 0) + 1);
            }
        }

        try {
            const dailyActPromises = ACTIVITY_TABLES.map(table =>
                supabaseAdmin.from(table)
                    .select('created_at')
                    .gte('created_at', fromDate)
                    .lte('created_at', toDate)
            );
            const dailyActResults = await Promise.all(dailyActPromises);
            dailyActResults.forEach(res => {
                (res.data || []).forEach(r => {
                    const d = r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : null;
                    if (d && dailyMap.has(d)) {
                        dailyMap.set(d, (dailyMap.get(d) || 0) + 1);
                    }
                });
            });
        } catch (dailyErr) {
            console.error('Error fetching daily activity counts:', dailyErr);
        }

        const dailyAcquisitionArr = Array.from(dailyMap.entries())
            .map(([date, leads]) => ({ date, leads }))
            .sort((a, b) => a.date.localeCompare(b.date));

        const totalLeadsCombined = (leadsCount.count || 0) + (felloLeadsCount.count || 0);

        return NextResponse.json({
            totalLeads: totalLeadsCombined,
            oldestLeadDate: oldestLead.data?.created_at || null,
            totalWaReachouts: activityWaCount,
            totalWaReplies: activityRepliesCount,
            totalVoiceCalls: Math.max(totalVoiceCallsCount, activityVoiceCount),
            ownerVoiceCalls: ownerVoiceCallsCount,
            normalVapiCost: Math.round(normalCostSum * 1e6) / 1e6,
            ownerVapiCost: Math.round(ownerCostSum * 1e6) / 1e6,
            dailyAcquisition: dailyAcquisitionArr,
            leadsDaily: dailyAcquisitionArr,
            ownerWaReachouts: 0,
            ownerWaReplies: 0,
            ...activityMetrics,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Error in master metrics route:', error);
        return NextResponse.json(EMPTY);
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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

const EMPTY: MasterMetrics = {
    totalLeads: 0, oldestLeadDate: null,
    totalWaReachouts: 0, totalWaReplies: 0,
    totalVoiceCalls: 0, ownerVoiceCalls: 0,
    normalVapiCost: 0, ownerVapiCost: 0,
    leadsDaily: [],
    ownerWaReachouts: 0, ownerWaReplies: 0,
};

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        // Try RPC first
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_master_metrics', {
            p_from: fromDate,
            p_to: toDate,
        });

        if (!rpcError && rpcData) {
            return NextResponse.json(rpcData, { headers: { 'Cache-Control': 'no-store' } });
        }

        // Fallback: direct queries
        const [leadsCount, oldestLead, voiceCalls, ownerVoiceCalls, normalCost, ownerCost, leadsDaily] = await Promise.all([
            supabaseAdmin.from('master_leads')
                .select('id', { count: 'exact', head: true }),
            supabaseAdmin.from('master_leads')
                .select('created_at')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle(),
            supabaseAdmin.from('fello_activity')
                .select('id', { count: 'exact', head: true })
                .eq('channel', 'voice')
                .gte('created_at', fromDate)
                .lte('created_at', toDate),
            supabaseAdmin.from('fello_activity')
                .select('id', { count: 'exact', head: true })
                .eq('channel', 'voice')
                .eq('vapi_account', 'owners')
                .gte('created_at', fromDate)
                .lte('created_at', toDate),
            supabaseAdmin.from('fello_activity')
                .select('cost_usd')
                .eq('channel', 'voice')
                .or('vapi_account.is.null,vapi_account.neq.owners')
                .gte('created_at', fromDate)
                .lte('created_at', toDate),
            supabaseAdmin.from('fello_activity')
                .select('cost_usd')
                .eq('channel', 'voice')
                .eq('vapi_account', 'owners')
                .gte('created_at', fromDate)
                .lte('created_at', toDate),
            supabaseAdmin.from('master_leads')
                .select('created_at')
                .gte('created_at', fromDate)
                .lte('created_at', toDate)
                .order('created_at', { ascending: true }),
        ]);

        const totalVoiceCallsCount = voiceCalls.count || 0;
        const ownerVoiceCallsCount = ownerVoiceCalls.count || 0;
        const normalCostSum = (normalCost.data || []).reduce((s, r) => s + (r.cost_usd || 0), 0);
        const ownerCostSum = (ownerCost.data || []).reduce((s, r) => s + (r.cost_usd || 0), 0);

        // Daily leads
        const dailyMap = new Map<string, number>();
        for (const r of leadsDaily.data || []) {
            const d = r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : null;
            if (!d) continue;
            dailyMap.set(d, (dailyMap.get(d) || 0) + 1);
        }
        const leadsDailyArr = Array.from(dailyMap.entries())
            .map(([date, leads]) => ({ date, leads }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return NextResponse.json({
            totalLeads: leadsCount.count || 0,
            oldestLeadDate: oldestLead.data?.created_at || null,
            totalWaReachouts: 0,
            totalWaReplies: 0,
            totalVoiceCalls: totalVoiceCallsCount,
            ownerVoiceCalls: ownerVoiceCallsCount,
            normalVapiCost: Math.round(normalCostSum * 1e6) / 1e6,
            ownerVapiCost: Math.round(ownerCostSum * 1e6) / 1e6,
            leadsDaily: leadsDailyArr,
            ownerWaReachouts: 0,
            ownerWaReplies: 0,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Error in master metrics route:', error);
        return NextResponse.json(EMPTY);
    }
}

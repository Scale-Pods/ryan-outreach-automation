import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const EMPTY = {
    totalCalls: 0, totalDuration: 0, avgDuration: 0, totalCost: 0, avgCost: 0,
    completedCalls: 0, answeredCalls: 0, successRate: 0,
    normalCalls: 0, ownerCalls: 0,
    normalConnected: 0, normalQualified: 0, normalPickupRate: 0, normalCompletionRate: 0,
    normalPositiveCount: 0, normalPositiveRate: 0,
    ownerConnected: 0, ownerQualified: 0, ownerPickupRate: 0, ownerCompletionRate: 0,
    ownerPositiveCount: 0, ownerPositiveRate: 0,
    allTimeNormalCalls: 0, allTimeOwnerCalls: 0,
    dailyVolume: [], hourlyDistribution: [], durationBuckets: [], costByDay: [],
};

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        // Try RPC first
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_voice_metrics_fello', {
            p_from: fromDate,
            p_to: toDate,
        });

        if (!rpcError && rpcData) {
            return NextResponse.json(rpcData, { headers: { 'Cache-Control': 'no-store' } });
        }

        // Fallback: direct computation
        const { data: rows } = await supabaseAdmin
            .from('fello_activity')
            .select('created_at, duration_seconds, cost_usd, status, vapi_account, sentiment')
            .eq('channel', 'voice')
            .gte('created_at', fromDate)
            .lte('created_at', toDate);

        const calls = rows || [];

        // All-time counts
        const { data: allTimeRows } = await supabaseAdmin
            .from('fello_activity')
            .select('vapi_account')
            .eq('channel', 'voice');

        const allTime = allTimeRows || [];
        const allTimeNormalCalls = allTime.filter(r => r.vapi_account !== 'owners').length;
        const allTimeOwnerCalls = allTime.filter(r => r.vapi_account === 'owners').length;

        // Summary
        const totalCalls = calls.length;
        const totalDuration = calls.reduce((s, r) => s + (r.duration_seconds || 0), 0);
        const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;
        const totalCost = calls.reduce((s, r) => s + (r.cost_usd || 0), 0);
        const avgCost = totalCalls > 0 ? totalCost / totalCalls : 0;

        const normalRows = calls.filter(r => r.vapi_account !== 'owners');
        const ownerRows = calls.filter(r => r.vapi_account === 'owners');

        const completedStatuses = ['assistant-ended-call', 'customer-ended-call', 'done', 'completed', 'success'];
        const answeredStatuses = ['answered', 'ended', 'customer-ended-call', 'assistant-ended-call', 'done', 'completed', 'success', 'voicemail'];

        const answeredCalls = calls.filter(r => answeredStatuses.includes(r.status)).length;
        const completedCalls = calls.filter(r => completedStatuses.includes(r.status)).length;
        const normalConnected = normalRows.filter(r => (r.duration_seconds || 0) > 18).length;
        const normalQualified = normalRows.filter(r => completedStatuses.includes(r.status)).length;
        const ownerConnected = ownerRows.filter(r => (r.duration_seconds || 0) > 18).length;
        const ownerQualified = ownerRows.filter(r => completedStatuses.includes(r.status)).length;

        const normalPositiveCount = normalRows.filter(r => {
            const s = (r.sentiment || '').toLowerCase();
            return s === 'positive' || s === 'hesitant';
        }).length;
        const ownerPositiveCount = ownerRows.filter(r => {
            const s = (r.sentiment || '').toLowerCase();
            return s === 'positive' || s === 'hesitant';
        }).length;

        const pct = (a: number, b: number) => b > 0 ? Math.round((a / b) * 10000) / 100 : 0;

        // Daily volume
        const dailyMap = new Map<string, { calls: number; cost: number }>();
        for (const r of calls) {
            const d = r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : null;
            if (!d) continue;
            const e = dailyMap.get(d) || { calls: 0, cost: 0 };
            e.calls++;
            e.cost += r.cost_usd || 0;
            dailyMap.set(d, e);
        }
        const dailyVolume = Array.from(dailyMap.entries())
            .map(([date, d]) => ({ date, calls: d.calls, cost: Math.round(d.cost * 1e6) / 1e6 }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Hourly
        const hourlyMap = new Map<number, number>();
        for (let h = 0; h < 24; h++) hourlyMap.set(h, 0);
        for (const r of calls) {
            if (r.created_at) {
                const h = new Date(r.created_at).getHours();
                hourlyMap.set(h, (hourlyMap.get(h) || 0) + 1);
            }
        }
        const hourlyDistribution = Array.from(hourlyMap.entries()).map(([hour, calls]) => ({ hour, calls }));

        // Duration buckets
        const durBuckets = [
            { label: '0-30s', min: 0, max: 30 },
            { label: '30s-1m', min: 31, max: 60 },
            { label: '1m-2m', min: 61, max: 120 },
            { label: '2m-5m', min: 121, max: 300 },
            { label: '5m+', min: 301, max: Infinity },
        ];
        const durationBuckets = durBuckets.map(b => ({
            label: b.label,
            calls: calls.filter(r => {
                const d = r.duration_seconds || 0;
                return d >= b.min && d <= b.max;
            }).length,
        }));

        return NextResponse.json({
            totalCalls,
            totalDuration,
            avgDuration: Math.round(avgDuration * 100) / 100,
            totalCost: Math.round(totalCost * 1e6) / 1e6,
            avgCost: Math.round(avgCost * 1e6) / 1e6,
            answeredCalls,
            completedCalls,
            successRate: pct(answeredCalls, totalCalls),
            normalCalls: normalRows.length,
            ownerCalls: ownerRows.length,
            normalConnected,
            normalQualified,
            normalPickupRate: pct(normalConnected, normalRows.length),
            normalCompletionRate: pct(normalQualified, normalRows.length),
            normalPositiveCount,
            normalPositiveRate: pct(normalPositiveCount, normalRows.length),
            ownerConnected,
            ownerQualified,
            ownerPickupRate: pct(ownerConnected, ownerRows.length),
            ownerCompletionRate: pct(ownerQualified, ownerRows.length),
            ownerPositiveCount,
            ownerPositiveRate: pct(ownerPositiveCount, ownerRows.length),
            allTimeNormalCalls,
            allTimeOwnerCalls,
            dailyVolume,
            hourlyDistribution,
            durationBuckets,
            costByDay: dailyVolume,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Error in voice metrics route:', error);
        return NextResponse.json(EMPTY);
    }
}

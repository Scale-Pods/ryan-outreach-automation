import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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

function endOfDay(iso: string): string {
    const d = new Date(iso);
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        d.setUTCHours(23, 59, 59, 999);
    }
    return d.toISOString();
}

export async function GET(req: Request) {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const includeElevenLabs = searchParams.get('includeElevenLabs') === 'true';

    const fromISO = fromParam || new Date(Date.now() - 7 * 86400000).toISOString();
    const toISO = toParam ? endOfDay(toParam) : endOfDay(new Date().toISOString());

    // Single RPC call — the database does all aggregation
    const rpcUrl = `${supabaseUrl}/rest/v1/rpc/get_voice_metrics`;
    const body = JSON.stringify({
        p_from: fromISO,
        p_to: toISO,
        p_include_eleven: includeElevenLabs,
    });

    try {
        const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
                apikey: secretKey,
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
            body,
            cache: 'no-store',
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`[voice-metrics] RPC error (${res.status}):`, err);
            return NextResponse.json({ error: 'RPC failed', detail: err }, { status: 502 });
        }

        const metrics: VoiceMetrics = await res.json();

        // costByDay mirrors dailyVolume — same data, aliased for the chart key
        if (metrics && !metrics.costByDay) {
            metrics.costByDay = metrics.dailyVolume ?? [];
        }

        return new NextResponse(JSON.stringify(metrics), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
        });
    } catch (err: any) {
        console.error('[voice-metrics] fetch error:', err);
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }
}

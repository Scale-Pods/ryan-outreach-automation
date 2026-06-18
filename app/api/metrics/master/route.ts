import { NextResponse } from 'next/server';

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
    totalOwnerLeads: number;
    ownerWaReachouts: number;
    ownerWaReplies: number;
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

    const fromISO = fromParam || new Date(Date.now() - 7 * 86400000).toISOString();
    const toISO = toParam ? endOfDay(toParam) : endOfDay(new Date().toISOString());

    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_master_metrics`, {
            method: 'POST',
            headers: {
                apikey: secretKey,
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            },
            body: JSON.stringify({ p_from: fromISO, p_to: toISO }),
            cache: 'no-store',
        });

        if (!res.ok) {
            const err = await res.text();
            console.error('[master-metrics] RPC error:', err);
            return NextResponse.json({ error: 'RPC failed', detail: err }, { status: 502 });
        }

        const metrics: MasterMetrics = await res.json();
        return new NextResponse(JSON.stringify(metrics), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
        });
    } catch (err: any) {
        console.error('[master-metrics] fetch error:', err);
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }
}

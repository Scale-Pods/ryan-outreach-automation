import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function endOfDay(iso: string): string {
    const d = new Date(iso);
    if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        d.setUTCHours(23, 59, 59, 999);
    }
    return d.toISOString();
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const fromISO = from || new Date(Date.now() - 7 * 86400000).toISOString();
    const toISO = to ? endOfDay(to) : endOfDay(new Date().toISOString());

    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_leads_for_display`, {
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
            console.error('[leads] RPC error:', err);
            return NextResponse.json({ error: 'RPC failed', detail: err }, { status: 502 });
        }

        const data = await res.json();

        // data is { master_leads, nr_wf, followup, nurture }
        // Combine all rows into a flat array the same way consolidateLeads expects
        const nr_wf = Array.isArray(data.nr_wf) ? data.nr_wf : [];
        const followup = Array.isArray(data.followup) ? data.followup : [];
        const nurture = Array.isArray(data.nurture) ? data.nurture : [];
        const master_leads = Array.isArray(data.master_leads) ? data.master_leads : [];

        return new NextResponse(
            JSON.stringify({ nr_wf, followup, nurture, master_leads }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                },
            }
        );
    } catch (err: any) {
        console.error('[leads] fetch error:', err);
        return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    }
}

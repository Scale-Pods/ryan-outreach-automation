import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Only the columns actually consumed by the UI — never fetch *
const SELECT_COLUMNS = [
    'id',
    'createdOn',
    'name',
    'contactNo',
    'Whatsapp_1',
    'Whatsapp_1_Date',
    'Whatsapp_1_status',
    'WTS_Reply_Track',
    'retry_1',
    'User_Replied_1', 'User_Replied_2', 'User_Replied_3', 'User_Replied_4', 'User_Replied_5',
    'User_Replied_6', 'User_Replied_7', 'User_Replied_8', 'User_Replied_9', 'User_Replied_10',
    'Bot_Replied_1', 'Bot_Replied_2', 'Bot_Replied_3', 'Bot_Replied_4', 'Bot_Replied_5',
    'Bot_Replied_6', 'Bot_Replied_7', 'Bot_Replied_8', 'Bot_Replied_9', 'Bot_Replied_10',
    'Bot_Replied_Status_1', 'Bot_Replied_Status_2', 'Bot_Replied_Status_3', 'Bot_Replied_Status_4', 'Bot_Replied_Status_5',
    'Bot_Replied_Status_6', 'Bot_Replied_Status_7', 'Bot_Replied_Status_8', 'Bot_Replied_Status_9', 'Bot_Replied_Status_10',
    'call Lead Status',
    'Lead_Status',
    'whatsapp_note',
].join(',');

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/$/, '');
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: 'Config missing' }, { status: 500 });
    }

    const baseUrl = `${supabaseUrl}/rest/v1`;
    const commonHeaders = {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        // Ask PostgREST to return row count so we can paginate correctly
        Prefer: 'count=planned',
    };

    // Date filter: use createdOn (timestamptz). If no dates provided, default to last 90 days
    // so we never fetch the entire table.
    const toISO = to || new Date().toISOString();
    const fromISO = from || new Date(Date.now() - 90 * 86400000).toISOString();

    let allData: any[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const url =
            `${baseUrl}/owner_data` +
            `?select=${encodeURIComponent(SELECT_COLUMNS)}` +
            `&createdOn=gte.${encodeURIComponent(fromISO)}` +
            `&createdOn=lte.${encodeURIComponent(toISO)}` +
            `&offset=${offset}&limit=${limit}`;

        try {
            const res = await fetch(url, { headers: commonHeaders, cache: 'no-store' });
            if (!res.ok) {
                const errMsg = await res.text();
                console.error('[owner-leads] Supabase error:', errMsg);
                break;
            }
            const data = await res.json();
            if (!Array.isArray(data)) { hasMore = false; break; }
            allData = allData.concat(data);
            if (data.length < limit) hasMore = false;
            else offset += limit;
        } catch (err) {
            console.error('[owner-leads] fetch error:', err);
            break;
        }

        if (offset > 50000) break; // hard safety cap
    }

    return new NextResponse(JSON.stringify({ owner_data: allData }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
    });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACTIVITY_TABLES = ['fello_activity', 'aspen_activity', 'naples_activity', 'old_activity'] as const;
const LEAD_TABLES = ['fello_leads', 'naples_leads', 'aspen_leads', 'master_leads'] as const;

function parseWADateToISO(raw: any): string | null {
    if (!raw) return null;
    if (typeof raw === 'number') return new Date(raw).toISOString();
    const s = String(raw).trim();
    if (!s) return null;

    // Check for DD/MM/YYYY HH:mm or DD/MM/YYYY HH:mm:ss or DD/MM/YYYY
    const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const year = ddmmyyyy[3];
        const hh = (ddmmyyyy[4] || '00').padStart(2, '0');
        const mm = (ddmmyyyy[5] || '00').padStart(2, '0');
        const ss = (ddmmyyyy[6] || '00').padStart(2, '0');
        const d = new Date(`${year}-${month}-${day}T${hh}:${mm}:${ss}.000Z`);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const fromDate = from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        let nr_wf: any[] = [];
        let followup: any[] = [];
        let nurture: any[] = [];
        let owners: any[] = [];

        // Try RPC first
        let rpcSuccess = false;
        try {
            const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_wa_leads_list', {
                p_from: fromDate,
                p_to: toDate,
            });
            if (!rpcError && rpcData) {
                nr_wf = rpcData.nr_wf || [];
                followup = rpcData.followup || [];
                nurture = rpcData.nurture || [];
                owners = rpcData.owners || [];
                rpcSuccess = true;
            }
        } catch {
            // RPC failed
        }

        // If RPC failed or returned no lead data, query lead tables directly
        if (!rpcSuccess || (nr_wf.length === 0 && followup.length === 0 && nurture.length === 0)) {
            for (const table of LEAD_TABLES) {
                try {
                    const { data, error } = await supabaseAdmin
                        .from(table)
                        .select('*');

                    if (!error && data && data.length > 0) {
                        data.forEach((row: any) => {
                            const waCnt = Number(row.whatsapp_count || 0);
                            const firstWa = row['1st_wa_ts'] || row.whatsapp_ts || row.last_whatsapp_at;
                            const hasWA = waCnt > 0 || !!firstWa;

                            if (hasWA) {
                                const dateRaw = firstWa || row.created_at;
                                const parsedISO = parseWADateToISO(dateRaw);
                                const hasWpReplyContent = !!(row.WP_Replied_track || row.whatsapp_replied || row["W.P_Replied 1"] || row["W.P_Replied_1"]);
                                const isWpReplied = hasWpReplyContent && row.replied && String(row.replied).trim() !== '' && String(row.replied).toLowerCase() !== 'no' && String(row.replied).toLowerCase() !== 'false';

                                const wp1MessageText = row["W.P_1"] || row.stage_data?.["WhatsApp 1"] || "Outreach WhatsApp Message";

                                nr_wf.push({
                                    ...row,
                                    _source_table: table,
                                    "Name": row.name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Lead',
                                    "Phone": row.phone || row.customer_phone || '',
                                    "W.P_1": wp1MessageText,
                                    "1st_wa_ts": dateRaw,
                                    wp1_parsed_date: parsedISO || row.created_at,
                                    "WP_Replied_track": isWpReplied ? (row.WP_Replied_track || "Replied") : "",
                                    whatsapp_count: waCnt > 0 ? waCnt : 1,
                                });
                            }
                        });
                    }
                } catch {
                    // skip table if missing
                }
            }
        }

        // Fetch WhatsApp activity data from all activity tables
        const waActivity: any[] = [];
        for (const table of ACTIVITY_TABLES) {
            try {
                const { data, error } = await supabaseAdmin
                    .from(table)
                    .select('*')
                    .ilike('channel', 'WhatsApp')
                    .gte('created_at', fromDate)
                    .lte('created_at', toDate)
                    .order('created_at', { ascending: false })
                    .limit(2000);

                if (!error && data && data.length > 0) {
                    waActivity.push(...data.map((row: any) => ({
                        ...row,
                        _source_table: table,
                        wp1_parsed_date: parseWADateToISO(row.created_at || row.started_at) || row.created_at,
                    })));
                }
            } catch {
                // skip tables that don't exist
            }
        }

        waActivity.sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at).getTime() : 0;
            const db = b.created_at ? new Date(b.created_at).getTime() : 0;
            return db - da;
        });

        return NextResponse.json({
            nr_wf,
            followup,
            nurture,
            owners,
            wa_activity: waActivity,
        }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (error) {
        console.error('Error in whatsapp-leads route:', error);
        return NextResponse.json({
            nr_wf: [], followup: [], nurture: [], owners: [], wa_activity: [],
        }, { status: 500 });
    }
}
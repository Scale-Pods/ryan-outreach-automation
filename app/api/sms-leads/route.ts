import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACTIVITY_TABLES = ['fello_activity', 'aspen_activity', 'naples_activity', 'old_activity'] as const;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const search = searchParams.get('search');

        const fromDate = from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        // Fetch SMS activity records across all 4 activity tables
        const smsActivity: any[] = [];
        for (const table of ACTIVITY_TABLES) {
            try {
                let query = supabaseAdmin
                    .from(table)
                    .select('*')
                    .ilike('channel', 'sms')
                    .gte('created_at', fromDate)
                    .lte('created_at', toDate)
                    .order('created_at', { ascending: false })
                    .limit(500);

                if (search) {
                    query = query.or(`lead_name.ilike.%${search}%,lead_phone.ilike.%${search}%,lead_email.ilike.%${search}%,content.ilike.%${search}%`);
                }

                const { data, error } = await query;

                if (!error && data && data.length > 0) {
                    smsActivity.push(...data.map((row: any) => ({
                        ...row,
                        _source_table: table,
                    })));
                }
            } catch {
                // skip tables that don't exist
            }
        }

        smsActivity.sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at).getTime() : 0;
            const db = b.created_at ? new Date(b.created_at).getTime() : 0;
            return db - da;
        });

        // Also attempt to fetch lead records with SMS touchpoints
        let smsLeads: any[] = [];
        try {
            const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_wa_leads_list', {
                p_from: fromDate,
                p_to: toDate,
            });
            if (!rpcError && rpcData) {
                const combined = [
                    ...(rpcData.nr_wf || []),
                    ...(rpcData.followup || []),
                    ...(rpcData.nurture || [])
                ];
                smsLeads = combined.filter((l: any) => l.Phone || l.phone);
            }
        } catch {
            // fallback
        }

        return NextResponse.json({
            sms_activity: smsActivity,
            sms_leads: smsLeads,
            total: smsActivity.length,
        }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (error) {
        console.error('Error in sms-leads route:', error);
        return NextResponse.json({
            sms_activity: [],
            sms_leads: [],
            total: 0,
        }, { status: 500 });
    }
}

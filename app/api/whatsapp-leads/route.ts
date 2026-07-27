import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACTIVITY_TABLES = ['fello_activity', 'aspen_activity', 'naples_activity', 'old_activity'] as const;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const fromDate = from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        // Try RPC first; if it fails, we still return activity data
        let nr_wf: any[] = [];
        let followup: any[] = [];
        let nurture: any[] = [];
        let owners: any[] = [];

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
            }
        } catch {
            // RPC failed (e.g. missing leads table) — use activity tables instead
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
                    .limit(500);

                if (!error && data && data.length > 0) {
                    waActivity.push(...data.map((row: any) => ({
                        ...row,
                        _source_table: table,
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
            wa_activity: waActivity.slice(0, 200),
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
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACTIVITY_TABLES = ['fello_activity', 'aspen_activity', 'naples_activity', 'old_activity'] as const;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        let nrWf: any[] = [];
        let followup: any[] = [];
        let nurture: any[] = [];
        let masterLeads: any[] = [];

        // Try RPC first
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_leads_for_display', {
            p_from: fromDate,
            p_to: toDate,
        });

        if (!rpcError && rpcData) {
            nrWf = rpcData.nr_wf || [];
            followup = rpcData.followup || [];
            nurture = rpcData.nurture || [];
            masterLeads = rpcData.master_leads || [];
        } else {
            if (rpcError) {
                console.error('RPC get_leads_for_display error, performing fallback queries:', rpcError.message);
            }
            // Fallback: direct queries on master_leads and fello_leads
            const [masterRes, felloRes] = await Promise.all([
                supabaseAdmin
                    .from('master_leads')
                    .select('*')
                    .gte('created_at', fromDate)
                    .lte('created_at', toDate)
                    .order('created_at', { ascending: false }),
                supabaseAdmin
                    .from('fello_leads')
                    .select('*')
                    .gte('created_at', fromDate)
                    .lte('created_at', toDate)
                    .order('created_at', { ascending: false }),
            ]);

            masterLeads = masterRes.data || [];
            nrWf = felloRes.data || [];
        }

        // Fetch activity leads from activity tables
        const activityLeads: any[] = [];
        for (const table of ACTIVITY_TABLES) {
            try {
                const { data, error: qErr } = await supabaseAdmin
                    .from(table)
                    .select('*')
                    .gte('created_at', fromDate)
                    .lte('created_at', toDate)
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (!qErr && data && data.length > 0) {
                    activityLeads.push(...data.map((r: any) => ({
                        ...r,
                        _source_table: table,
                    })));
                }
            } catch {
                // skip tables that don't exist
            }
        }

        activityLeads.sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at).getTime() : 0;
            const db = b.created_at ? new Date(b.created_at).getTime() : 0;
            return db - da;
        });

        return NextResponse.json({
            nr_wf: nrWf,
            followup: followup,
            nurture: nurture,
            master_leads: masterLeads,
            activity_leads: activityLeads,
        }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (error: any) {
        console.error('Error in leads route:', error);
        return NextResponse.json(
            { nr_wf: [], followup: [], nurture: [], master_leads: [], activity_leads: [] },
            { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
        );
    }
}

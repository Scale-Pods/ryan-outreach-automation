import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        const { data, error } = await supabaseAdmin.rpc('get_leads_for_display', {
            p_from: fromDate,
            p_to: toDate,
        });

        if (error) {
            console.error('Error fetching leads via RPC, trying direct query:', error);
            // Fallback: return fello_leads under master_leads key
            const { data: fallback } = await supabaseAdmin
                .from('master_leads')
                .select('id, name, phone, email, created_at')
                .gte('created_at', fromDate)
                .lte('created_at', toDate)
                .order('created_at', { ascending: false });
            return NextResponse.json({
                nr_wf: [],
                followup: [],
                nurture: [],
                master_leads: fallback || [],
            }, {
                headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
            });
        }

        return NextResponse.json(data, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (error) {
        console.error('Error in leads route:', error);
        return NextResponse.json(
            { nr_wf: [], followup: [], nurture: [], master_leads: [] },
        );
    }
}

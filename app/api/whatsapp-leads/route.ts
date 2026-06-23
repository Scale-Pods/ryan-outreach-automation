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

        const { data, error } = await supabaseAdmin
            .from('leads')
            .select('*')
            .not('wp_1_at', 'is', null)
            .gte('created_at', fromDate)
            .lte('created_at', toDate)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching whatsapp leads:', error);
            return NextResponse.json({ nr_wf: [], followup: [], nurture: [], owners: [] }, { status: 500 });
        }

        const leads = data || [];
        const grouped = {
            nr_wf: leads.filter((l: any) => l.loop === 'intro'),
            followup: leads.filter((l: any) => l.loop === 'followup'),
            nurture: leads.filter((l: any) => l.loop === 'nurture'),
            owners: leads.filter((l: any) => l.loop === 'master'),
        };

        return NextResponse.json(grouped, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (error) {
        console.error('Error in whatsapp-leads route:', error);
        return NextResponse.json({ nr_wf: [], followup: [], nurture: [], owners: [] }, { status: 500 });
    }
}

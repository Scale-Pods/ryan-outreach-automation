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
            .from('fello_leads')
            .select('*')
            .gte('created_at', fromDate)
            .lte('created_at', toDate)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching raw leads:', error);
            return NextResponse.json([], { status: 500 });
        }

        return NextResponse.json(data || [], {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (error) {
        console.error('Error in leads-raw route:', error);
        return NextResponse.json([], { status: 500 });
    }
}

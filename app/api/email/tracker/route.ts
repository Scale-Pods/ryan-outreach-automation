import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/email/tracker — fetch all rows from email_tracker
export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('email_tracker')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ trackers: data || [] }, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (err: any) {
        console.error('[email/tracker GET]', err);
        return NextResponse.json({ error: err.message, trackers: [] }, { status: 500 });
    }
}

// PATCH /api/email/tracker — update max_allowed for a specific email row
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, max_allowed } = body;

        if (!id || max_allowed === undefined) {
            return NextResponse.json({ error: 'id and max_allowed are required' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('email_tracker')
            .update({ max_allowed: String(max_allowed) })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ tracker: data });
    } catch (err: any) {
        console.error('[email/tracker PATCH]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

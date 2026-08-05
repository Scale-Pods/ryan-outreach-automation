import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACTIVITY_TABLES = ['fello_activity', 'aspen_activity', 'naples_activity', 'old_activity'] as const;

/**
 * Public API for share links — no auth required.
 * Fetches activity logs by phone number (WhatsApp/SMS) or email.
 * 
 * GET /api/public/share?channel=whatsapp&phone=%2B12345678900
 * GET /api/public/share?channel=sms&phone=%2B12345678900
 * GET /api/public/share?channel=email&email=user@example.com
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const channel = searchParams.get('channel') || '';
        const phone = searchParams.get('phone') || '';
        const email = searchParams.get('email') || '';

        if (!channel || (!phone && !email)) {
            return NextResponse.json(
                { error: 'Missing required params: channel and phone or email' },
                { status: 400, headers: { 'Cache-Control': 'no-store' } }
            );
        }

        const activities: any[] = [];

        for (const table of ACTIVITY_TABLES) {
            try {
                let query = supabaseAdmin
                    .from(table)
                    .select('*')
                    .ilike('channel', channel)
                    .order('created_at', { ascending: true });

                if (phone) {
                    // Strip non-digit chars for fuzzy match
                    const cleanPhone = phone.replace(/\D/g, '');
                    // Use ilike to match the phone number in lead_phone column
                    query = query.ilike('lead_phone', `%${cleanPhone.slice(-10)}%`);
                } else if (email) {
                    query = query.ilike('lead_email', `%${email.trim()}%`);
                }

                const { data, error } = await query.limit(200);

                if (!error && data && data.length > 0) {
                    activities.push(...data.map((row: any) => ({ ...row, _source_table: table })));
                }
            } catch {
                // skip unavailable tables
            }
        }

        // Deduplicate by id
        const seen = new Set<string>();
        const unique = activities.filter(a => {
            const key = String(a.id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort by created_at ascending (oldest first = chronological chat order)
        unique.sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at).getTime() : 0;
            const db = b.created_at ? new Date(b.created_at).getTime() : 0;
            return da - db;
        });

        // Derive lead metadata from the first activity row
        const first = unique[0] || null;
        const lead = first ? {
            id: first.lead_id || first.id,
            name: first.lead_name || phone || email,
            phone: first.lead_phone || phone,
            email: first.lead_email || email,
            campaign: first.campaign || first.source_loop || '',
            status: first.status || '',
            source_table: first._source_table || first.source_table || '',
            action_type: first.action_type || '',
            summary: first.summary || '',
            lead_temp: first.lead_temp || first.lead_temperature || first.sentiment || '',
        } : null;

        return NextResponse.json(
            { lead, activities: unique },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                    'Pragma': 'no-cache',
                },
            }
        );
    } catch (err) {
        console.error('[public/share] Error:', err);
        return NextResponse.json(
            { error: 'Internal server error', lead: null, activities: [] },
            { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
    }
}

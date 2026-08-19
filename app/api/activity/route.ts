import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACTIVITY_TABLES = ['fello_activity', 'aspen_activity', 'naples_activity', 'old_activity'] as const;

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const channel = searchParams.get('channel');
        const reply = searchParams.get('reply');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const fromDate = from || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        const allResults: any[] = [];
        let totalCount = 0;
        const errors: string[] = [];

        for (const table of ACTIVITY_TABLES) {
            try {
                let countQuery = supabaseAdmin
                    .from(table)
                    .select('id', { count: 'exact', head: true });

                let dataQuery = supabaseAdmin
                    .from(table)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(limit);

                // Apply date filter if search is not present or if explicit dates provided
                if (from || !search) {
                    countQuery = countQuery.gte('created_at', fromDate).lte('created_at', toDate);
                    dataQuery = dataQuery.gte('created_at', fromDate).lte('created_at', toDate);
                }

                if (channel && channel !== 'all') {
                    countQuery = countQuery.ilike('channel', channel);
                    dataQuery = dataQuery.ilike('channel', channel);
                }

                if (reply && reply !== 'all') {
                    if (reply === 'yes') {
                        const filterReply = 'replied.ilike.yes,replied.eq.true,status.ilike.%reply%,status.ilike.%replied%';
                        countQuery = countQuery.or(filterReply);
                        dataQuery = dataQuery.or(filterReply);
                    } else if (reply === 'no') {
                        const filterNoReply = 'replied.ilike.no,replied.is.null,replied.eq.false';
                        countQuery = countQuery.or(filterNoReply);
                        dataQuery = dataQuery.or(filterNoReply);
                    }
                }

                if (search) {
                    const cleanSearch = search.trim();
                    const isNum = /^\d+$/.test(cleanSearch);
                    let filter = `lead_name.ilike.%${cleanSearch}%,lead_phone.ilike.%${cleanSearch}%,lead_email.ilike.%${cleanSearch}%,action_type.ilike.%${cleanSearch}%,note.ilike.%${cleanSearch}%,content.ilike.%${cleanSearch}%,summary.ilike.%${cleanSearch}%,replied.ilike.%${cleanSearch}%`;
                    if (isNum) {
                        filter += `,lead_id.eq.${cleanSearch},id.eq.${cleanSearch}`;
                    }
                    countQuery = countQuery.or(filter);
                    dataQuery = dataQuery.or(filter);
                }

                const [countResult, dataResult] = await Promise.all([
                    countQuery,
                    dataQuery,
                ]);

                if (countResult.error) {
                    errors.push(`${table} count: ${countResult.error.message}`);
                    continue;
                }
                if (dataResult.error) {
                    errors.push(`${table} data: ${dataResult.error.message}`);
                    continue;
                }

                if (dataResult.data && dataResult.data.length > 0) {
                    const tagged = dataResult.data.map((row: any) => ({
                        ...row,
                        _source_table: table,
                    }));
                    allResults.push(...tagged);
                }
                totalCount += countResult.count || 0;
            } catch (tableErr: any) {
                errors.push(`${table}: ${tableErr.message}`);
            }
        }

        allResults.sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at).getTime() : 0;
            const db = b.created_at ? new Date(b.created_at).getTime() : 0;
            return db - da;
        });

        const offset = (page - 1) * limit;
        const paginated = allResults.slice(offset, offset + limit);

        return NextResponse.json({
            activities: paginated,
            total: totalCount,
            page,
            limit,
            errors: errors.length > 0 ? errors : undefined,
        }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (error: any) {
        console.error('Error in activity route:', error);
        return NextResponse.json({
            activities: [],
            total: 0,
            page: 1,
            limit: 50,
            errors: [error.message],
        }, { status: 500 });
    }
}

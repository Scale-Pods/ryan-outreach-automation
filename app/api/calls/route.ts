import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const UAE_BOT_ID = '70f05e16-18f3-4f6e-964a-f47b299c6c1d';
const UAE_BUSINESS_NUMBER = '+97148714150';
const OPEN_HOUSE_ASSISTANT = '1ef6ea66-0a75-45f5-b025-1743e048dc90';
const SECONDARY_LEADS_ASSISTANT = '560ca61b-8cd3-4b5f-996b-2966abfa37fd';
const UAE_IDS = ['70f05e16-18f3-4f6e-964a-f47b299c6c1d', '9ac979c3-a0b3-4af6-bb0d-07ddf9c0d1cd'];
const US_IDS = ['b35e3032-7865-4913-ba22-a913b5d4117b'];
const UK_IDS = ['918c25eb-9882-452e-86df-b4851d464852'];

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const account = searchParams.get('account');
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const phone = searchParams.get('phone');
        const leadTemp = searchParams.get('leadTemp');
        const sort = searchParams.get('sort');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        // Try RPC first
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_voice_calls', {
            p_from: fromDate,
            p_to: toDate,
            p_account: account || null,
            p_status: status || 'all',
            p_type: type || 'all',
            p_phone: phone || null,
            p_lead_temp: leadTemp || 'all',
            p_sort: sort || 'newest',
            p_page: page,
            p_limit: limit,
        });

        if (!rpcError && rpcData) {
            let calls = rpcData.calls || [];
            if (calls.length > 0) {
                const vapiCallIds = calls.map((c: any) => c.id).filter((id: string) => id && id.includes('-'));
                const integerIds = calls.map((c: any) => Number(c.id)).filter((id: number) => !isNaN(id));

                const queryBuilder = supabaseAdmin
                    .from('fello_activity')
                    .select('vapi_call_id, id, lead_temp');

                const orConditions = [];
                if (vapiCallIds.length > 0) {
                    orConditions.push(`vapi_call_id.in.(${vapiCallIds.map((id: string) => `"${id}"`).join(',')})`);
                }
                if (integerIds.length > 0) {
                    orConditions.push(`id.in.(${integerIds.join(',')})`);
                }

                if (orConditions.length > 0) {
                    const { data: temps } = await queryBuilder.or(orConditions.join(','));
                    const tempMap = new Map();
                    if (temps) {
                        for (const t of temps) {
                            if (t.vapi_call_id) tempMap.set(t.vapi_call_id, t.lead_temp);
                            if (t.id) tempMap.set(String(t.id), t.lead_temp);
                        }
                    }
                    calls = calls.map((c: any) => ({
                        ...c,
                        leadTemp: tempMap.get(c.id) || 'Unknown'
                    }));
                } else {
                    calls = calls.map((c: any) => ({
                        ...c,
                        leadTemp: 'Unknown'
                    }));
                }
            }
            return NextResponse.json({ calls, total: rpcData.total || calls.length }, {
                headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
            });
        }

        // Fallback: direct query
        let query = supabaseAdmin
            .from('fello_activity')
            .select('*', { count: 'exact' })
            .eq('channel', 'voice')
            .gte('created_at', fromDate)
            .lte('created_at', toDate);

        if (account && account !== 'vapi') {
            if (account === 'vapi-normal') {
                query = query.or('vapi_account.is.null,vapi_account.neq.owners');
            } else if (account === 'open-house') {
                query = query.eq('assistant_id', OPEN_HOUSE_ASSISTANT);
            }
        }

        if (status && status !== 'all') {
            query = query.ilike('status', status);
        }

        if (type && type !== 'all') {
            if (type === 'Inbound') {
                query = query.ilike('action_type', '%inbound%');
            } else if (type === 'Outbound') {
                query = query.not('action_type', 'ilike', '%inbound%');
            } else if (type === 'normal') {
                query = query.neq('assistant_id', SECONDARY_LEADS_ASSISTANT);
            } else if (type === 'secondary-leads') {
                query = query.eq('assistant_id', SECONDARY_LEADS_ASSISTANT);
            }
        }

        if (phone) {
            const cleanPhone = phone.replace(/\D/g, '');
            query = query.or(`lead_name.ilike.%${phone}%,lead_phone.ilike.%${cleanPhone}%`);
        }

        if (leadTemp && leadTemp !== 'all') {
            query = query.ilike('lead_temp', leadTemp);
        }

        // Sort
        const ascending = sort === 'oldest' || sort === 'shortest';
        if (sort === 'longest' || sort === 'shortest') {
            query = query.order('duration_seconds', { ascending });
        } else {
            query = query.order('created_at', { ascending: ascending });
        }

        // Count total before pagination
        let countQuery = supabaseAdmin
            .from('fello_activity')
            .select('*', { count: 'exact', head: true })
            .eq('channel', 'voice')
            .gte('created_at', fromDate)
            .lte('created_at', toDate);

        if (leadTemp && leadTemp !== 'all') {
            countQuery = countQuery.ilike('lead_temp', leadTemp);
        }

        const { count: totalCount } = await countQuery;

        // Paginate
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching voice calls:', error);
            return NextResponse.json({ calls: [], total: 0 }, { status: 500 });
        }

        // Fetch leads for name resolution
        const { data: leadsData } = await supabaseAdmin
            .from('master_leads')
            .select('phone, name')
            .not('phone', 'is', null)
            .neq('phone', '');

        const leadsMap = new Map<string, string>();
        if (leadsData) {
            for (const l of leadsData) {
                const phone = String(l.phone || '').replace(/\D/g, '');
                if (phone && l.name) leadsMap.set(phone, l.name);
            }
        }

        const rows = data || [];

        // Resolve names + format
        const calls = rows.map((row: any) => {
            const isInbound = row.action_type?.toLowerCase().includes('inbound');
            const phoneStr = String(row.lead_phone || '');
            const phoneClean = phoneStr.replace(/\D/g, '');

            // Name resolution
            let name = row.lead_name || 'Guest';
            if (['Guest', 'Unknown', ''].includes(name) && phoneClean.length > 5) {
                const resolved = leadsMap.get(phoneClean);
                if (resolved) name = resolved;
            }

            // Type resolution
            let resolvedType = isInbound ? 'Inbound' : 'Outbound';
            if (resolvedType === 'Inbound') {
                const isFromUAEBot = row.assistant_id === UAE_BOT_ID;
                const isFromUAENumber = false;
                if ((isFromUAEBot || isFromUAENumber) && row.lead_phone) {
                    resolvedType = 'Outbound';
                }
            }

            // Display fields
            const displayDate = row.created_at
                ? new Date(row.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true
                })
                : 'N/A';

            const dur = row.duration_seconds || 0;
            let displayDuration: string;
            if (dur >= 3600) {
                displayDuration = `${Math.floor(dur / 3600)}h ${Math.floor((dur % 3600) / 60)}m ${dur % 60}s`;
            } else if (dur >= 60) {
                displayDuration = `${Math.floor(dur / 60)}m ${dur % 60}s`;
            } else {
                displayDuration = `${dur}s`;
            }

            return {
                id: row.vapi_call_id || String(row.id),
                name,
                phone: row.lead_phone || 'Unknown',
                startedAt: row.created_at,
                durationSeconds: dur,
                cost: row.cost_usd != null ? `$${row.cost_usd.toFixed(3)}` : '$0.00',
                costValue: row.cost_usd || 0,
                status: row.status || 'unknown',
                source: 'vapi',
                isInbound,
                type: resolvedType,
                sentiment: row.sentiment || null,
                summary: row.summary || null,
                recordingUrl: row.recording_url || null,
                transcript: row.transcript || null,
                vapiAccount: row.vapi_account || null,
                assistantId: row.assistant_id || null,
                phoneNumber: null,
                leadTemp: row.lead_temp || 'Unknown',
                breakdown: { agent: row.cost_usd || 0, telephony: 0 },
                leadId: row.lead_id,
                workflowName: row.workflow_name,
                appointmentDatetime: row.appointment_datetime,
                note: row.note,
                content: row.content,
                displayDate,
                displayDuration,
            };
        });

        return NextResponse.json({ calls, total: totalCount || calls.length }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (error) {
        console.error('Error in calls route:', error);
        return NextResponse.json({ calls: [], total: 0 }, { status: 500 });
    }
}

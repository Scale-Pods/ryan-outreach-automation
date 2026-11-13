import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACTIVITY_TABLES = ['fello_activity', 'aspen_activity', 'naples_activity', 'old_activity'] as const;

const UAE_BOT_ID = '70f05e16-18f3-4f6e-964a-f47b299c6c1d';
const OPEN_HOUSE_ASSISTANT = '1ef6ea66-0a75-45f5-b025-1743e048dc90';
const SECONDARY_LEADS_ASSISTANT = '560ca61b-8cd3-4b5f-996b-2966abfa37fd';

const KNOWN_PHONES: Record<string, string> = {
    '4a7e7a31-0bbc-4fde-831e-2489119ee226': '17624000439',
    'e66fe46b-9fe2-4628-a32b-08ced680bc04': '97144396291',
    '4baf3613-ba3d-4860-9ea1-62156686b6f1': '447462179309',
    '66dff692-d2a5-47d4-bbe0-245509dc7404': '14782159151',
    'd91ba874-2522-4d62-adf6-681f2a0bf4fe': '97148714150',
};

// Helper to parse transcript string into structured message turns
function parseTranscriptTurns(transcriptRaw: any): Array<{ role: string; message: string; startTime?: number }> {
    if (!transcriptRaw) return [];

    if (Array.isArray(transcriptRaw)) {
        return transcriptRaw.map((msg: any) => ({
            role: (msg.role === 'agent' || msg.role === 'bot' || msg.role === 'assistant' || msg.role === 'model') ? 'assistant' : (msg.role || 'user'),
            message: msg.message || msg.content || msg.text || '',
            startTime: msg.startTime ?? msg.start_time ?? msg.time ?? msg.timestamp,
        }));
    }

    if (typeof transcriptRaw === 'string') {
        const text = transcriptRaw.trim();
        if (!text) return [];

        const parts = text.split(/(?=(?:AI|User|Assistant|Agent|Bot|Guest|Customer|Caller|System):\s*)/i);
        if (parts.length > 1) {
            const turns: Array<{ role: string; message: string; startTime?: number }> = [];
            for (const part of parts) {
                const trimmed = part.trim();
                if (!trimmed) continue;
                const match = trimmed.match(/^(AI|User|Assistant|Agent|Bot|Guest|Customer|Caller|System):\s*([\s\S]*)/i);
                if (match) {
                    const roleLabel = match[1].toLowerCase();
                    const content = match[2].trim();
                    const role = (roleLabel === 'ai' || roleLabel === 'assistant' || roleLabel === 'agent' || roleLabel === 'bot')
                        ? 'assistant'
                        : 'user';
                    turns.push({ role, message: content });
                } else {
                    turns.push({ role: 'assistant', message: trimmed });
                }
            }
            return turns;
        }

        // Check if there are newline separated dialogue turns
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length > 1 && lines.some(l => /^(user|bot|agent|ai):/i.test(l.trim()))) {
            const turns: Array<{ role: string; message: string }> = [];
            for (const line of lines) {
                const m = line.match(/^(user|bot|agent|ai):\s*(.*)$/i);
                if (m) {
                    const role = m[1].toLowerCase() === 'user' ? 'user' : 'assistant';
                    turns.push({ role, message: m[2].trim() });
                } else if (turns.length > 0) {
                    turns[turns.length - 1].message += '\n' + line.trim();
                }
            }
            return turns;
        }

        return [{ role: 'assistant', message: text }];
    }

    return [];
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id: rawId } = await context.params;
        const decodedId = decodeURIComponent(rawId || '').trim();

        if (!decodedId) {
            return NextResponse.json({ error: 'Missing call ID' }, { status: 400 });
        }

        const uuidMatch = decodedId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        const searchId = uuidMatch ? uuidMatch[0] : (decodedId.includes('\n') ? decodedId.split('\n').pop()?.trim() || decodedId : decodedId);

        let vapiData: any = null;
        const vapiPrivKey = process.env.VAPI_PRIVATE_KEY;

        // Try Vapi API if key and UUID present
        if (vapiPrivKey && uuidMatch) {
            try {
                const vapiRes = await fetch(`https://api.vapi.ai/call/${searchId}`, {
                    headers: {
                        'Authorization': `Bearer ${vapiPrivKey}`,
                        'Content-Type': 'application/json',
                    },
                    cache: 'no-store',
                });
                if (vapiRes.ok) {
                    vapiData = await vapiRes.json();
                }
            } catch (err) {
                console.error('[public/call] Vapi fetch error:', err);
            }
        }

        // Try querying Supabase activity tables
        let dbRow: any = null;
        let sourceTable: string = '';

        for (const table of ACTIVITY_TABLES) {
            try {
                let query = supabaseAdmin.from(table).select('*');

                if (uuidMatch) {
                    query = query.ilike('vapi_call_id', `%${searchId}%`);
                } else if (/^\d+$/.test(searchId)) {
                    query = query.or(`id.eq.${Number(searchId)},vapi_call_id.ilike.%${searchId}%`);
                } else {
                    const cleanPhone = searchId.replace(/\D/g, '');
                    if (cleanPhone.length >= 6) {
                        query = query.ilike('lead_phone', `%${cleanPhone.slice(-10)}%`).ilike('channel', 'voice');
                    } else {
                        query = query.ilike('vapi_call_id', `%${searchId}%`);
                    }
                }

                const { data, error } = await query.order('created_at', { ascending: false }).limit(1);

                if (!error && data && data.length > 0) {
                    dbRow = data[0];
                    sourceTable = table;
                    break;
                }
            } catch (err) {
                // Continue to next table
            }
        }

        if (!vapiData && !dbRow) {
            return NextResponse.json(
                { error: 'Call record not found' },
                { status: 404, headers: { 'Cache-Control': 'no-store' } }
            );
        }

        // Resolve customer name from master_leads if needed
        let resolvedName: string | null = null;
        const targetPhone = vapiData?.customer?.number || dbRow?.lead_phone || '';
        const cleanPhone = String(targetPhone).replace(/\D/g, '');

        if (cleanPhone.length >= 7) {
            try {
                const { data: leadData } = await supabaseAdmin
                    .from('master_leads')
                    .select('name')
                    .ilike('phone', `%${cleanPhone.slice(-10)}%`)
                    .limit(1);

                if (leadData && leadData.length > 0 && leadData[0].name) {
                    resolvedName = leadData[0].name;
                }
            } catch { }
        }

        // Compute merged values
        const id = vapiData?.id || dbRow?.vapi_call_id || String(dbRow?.id || searchId);
        const rawCustomerNumber = vapiData?.customer?.number || dbRow?.lead_phone || 'Unknown';
        const customerNumberClean = String(rawCustomerNumber).replace(/\D/g, '');
        const phone = customerNumberClean.length > 5 ? `+${customerNumberClean}` : (rawCustomerNumber || 'Unknown');

        const rawCustomerName = vapiData?.customer?.name || dbRow?.lead_name || '';
        let guestName = resolvedName || rawCustomerName || 'Guest';
        if (/^\d+$/.test(guestName.replace(/\D/g, '')) && guestName.length > 5) {
            guestName = 'Guest';
        }

        const isInbound = (vapiData?.type?.toLowerCase().includes('inbound')) ||
            (dbRow?.action_type?.toLowerCase().includes('inbound')) ||
            false;

        let assistantPhone = 'Unknown';
        if (vapiData?.phoneNumber?.number) {
            assistantPhone = vapiData.phoneNumber.number;
        } else if (vapiData?.phoneNumberId && KNOWN_PHONES[vapiData.phoneNumberId]) {
            assistantPhone = KNOWN_PHONES[vapiData.phoneNumberId];
        } else if (dbRow?.assistant_id === UAE_BOT_ID) {
            assistantPhone = '+97148714150';
        }

        const startedAt = vapiData?.startedAt || dbRow?.created_at || new Date().toISOString();
        const durationSeconds = typeof vapiData?.durationSeconds === 'number'
            ? vapiData.durationSeconds
            : (dbRow?.duration_seconds || 0);

        const cost = vapiData?.cost != null
            ? (typeof vapiData.cost === 'number' ? `$${vapiData.cost.toFixed(3)}` : String(vapiData.cost))
            : (dbRow?.cost_usd != null ? `$${dbRow.cost_usd.toFixed(3)}` : '$0.00');

        const status = vapiData?.status || dbRow?.status || 'ended';

        // Extract audio/recording URL
        let recordingUrl: string | null = null;
        let callOrderTitle: string | null = null;
        const candidates = [
            vapiData?.recordingUrl,
            vapiData?.artifact?.recordingUrl,
            vapiData?.audio_url,
            dbRow?.recording_url,
        ];

        for (const candidate of candidates) {
            if (!candidate || typeof candidate !== 'string') continue;
            const match = candidate.match(/https?:\/\/[^\s\)\"\']+/i);
            if (match) {
                recordingUrl = match[0];
                if (match.index && match.index > 0) {
                    const prefix = candidate.substring(0, match.index).trim();
                    if (prefix) callOrderTitle = prefix.replace(/[\n\r]+/g, ' ').trim();
                }
                break;
            }
        }

        // Extract summary
        const summary = vapiData?.analysis?.summary ||
            vapiData?.summary ||
            dbRow?.summary ||
            dbRow?.note ||
            '';

        // Extract transcript & message turns
        const transcriptRaw = vapiData?.transcript ||
            vapiData?.messages ||
            vapiData?.analysis?.transcript ||
            dbRow?.transcript ||
            dbRow?.content ||
            '';

        const messages = parseTranscriptTurns(transcriptRaw);

        const leadTemp = dbRow?.lead_temp ||
            dbRow?.lead_temperature ||
            dbRow?.sentiment ||
            vapiData?.analysis?.structuredData?.lead_temperature ||
            'Unknown';

        const assistantId = vapiData?.assistantId || dbRow?.assistant_id || '';
        let assistantName = vapiData?.assistant?.name || '';
        if (!assistantName) {
            if (assistantId === UAE_BOT_ID) assistantName = 'UAE Voice Assistant';
            else if (assistantId === OPEN_HOUSE_ASSISTANT) assistantName = 'Open House Assistant';
            else if (assistantId === SECONDARY_LEADS_ASSISTANT) assistantName = 'Secondary Leads Assistant';
            else assistantName = 'AI Voice Assistant';
        }

        const call = {
            id,
            name: guestName,
            phone,
            customer_number: customerNumberClean,
            phoneNumber: assistantPhone,
            assistantPhone,
            assistantId,
            assistantName,
            startedAt,
            durationSeconds,
            cost,
            status,
            type: isInbound ? 'Inbound' : 'Outbound',
            isInbound,
            leadTemp,
            audioUrl: recordingUrl,
            recordingUrl,
            callOrderTitle,
            summary,
            transcript: typeof transcriptRaw === 'string' ? transcriptRaw : JSON.stringify(transcriptRaw),
            messages,
            sourceTable: sourceTable || dbRow?._source_table || 'fello_activity',
            campaign: dbRow?.campaign || dbRow?.source_loop || '',
            workflowName: dbRow?.workflow_name || '',
            note: dbRow?.note || '',
            appointmentDatetime: dbRow?.appointment_datetime || null,
        };

        return NextResponse.json(
            { call },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate',
                    'Pragma': 'no-cache',
                },
            }
        );
    } catch (error) {
        console.error('[public/call] Unhandled error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers: { 'Cache-Control': 'no-store' } }
        );
    }
}


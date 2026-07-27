import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACTIVITY_TABLES = ['fello_activity', 'aspen_activity', 'naples_activity', 'old_activity'] as const;

export interface WhatsappMetrics {
    totalReachouts: number;
    totalReplies: number;
    replyRate: number;
    dailyTrend: { date: string; reachouts: number; replies: number }[];
    ownerReachouts: number;
    ownerReplies: number;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        let totalReachouts = 0;
        let totalReplies = 0;
        let ownerReachouts = 0;
        let ownerReplies = 0;
        const dailyMap: Record<string, { reachouts: number; replies: number }> = {};

        for (const table of ACTIVITY_TABLES) {
            try {
                const { data, error } = await supabaseAdmin
                    .from(table)
                    .select('created_at, status, vapi_account')
                    .ilike('channel', 'WhatsApp')
                    .gte('created_at', fromDate)
                    .lte('created_at', toDate);

                if (!error && data) {
                    for (const row of data) {
                        totalReachouts++;
                        const isReplied = row.status === 'completed' || row.status === 'replied';
                        if (isReplied) totalReplies++;

                        if (row.vapi_account === 'owners') {
                            ownerReachouts++;
                            if (isReplied) ownerReplies++;
                        }

                        if (row.created_at) {
                            const dayKey = new Date(row.created_at).toISOString().slice(0, 10);
                            if (!dailyMap[dayKey]) dailyMap[dayKey] = { reachouts: 0, replies: 0 };
                            dailyMap[dayKey].reachouts++;
                            if (isReplied) dailyMap[dayKey].replies++;
                        }
                    }
                }
            } catch {
                // skip tables that don't exist
            }
        }

        const dailyTrend = Object.entries(dailyMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, vals]) => ({ date, ...vals }));

        const replyRate = totalReachouts > 0 ? Math.round((totalReplies / totalReachouts) * 100) / 100 : 0;

        return NextResponse.json({
            totalReachouts,
            totalReplies,
            replyRate,
            dailyTrend,
            ownerReachouts,
            ownerReplies,
        } satisfies WhatsappMetrics, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });
    } catch (error) {
        console.error('Error in whatsapp metrics route:', error);
        const empty: WhatsappMetrics = {
            totalReachouts: 0, totalReplies: 0, replyRate: 0,
            dailyTrend: [], ownerReachouts: 0, ownerReplies: 0,
        };
        return NextResponse.json(empty, { status: 500 });
    }
}
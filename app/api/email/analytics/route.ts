import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACTIVITY_TABLES = ['aspen_activity', 'fello_activity', 'naples_activity', 'old_activity'] as const;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('start_date');
        const to = searchParams.get('end_date');

        const fromDate = from ? new Date(from).toISOString() : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to ? new Date(to).toISOString() : new Date().toISOString();

        const tableStats: Record<string, { name: string; totalSent: number; totalReplies: number; totalUnsubscribed: number }> = {
            aspen_activity: { name: 'Aspen', totalSent: 0, totalReplies: 0, totalUnsubscribed: 0 },
            fello_activity: { name: 'Fello', totalSent: 0, totalReplies: 0, totalUnsubscribed: 0 },
            naples_activity: { name: 'Naples', totalSent: 0, totalReplies: 0, totalUnsubscribed: 0 },
            old_activity: { name: 'Old Leads', totalSent: 0, totalReplies: 0, totalUnsubscribed: 0 },
        };

        const dailyMap: Record<string, { date: string; sent: number; replies: number }> = {};
        let grandTotalSent = 0;
        let grandTotalReplies = 0;
        let grandTotalUnsubscribed = 0;

        for (const table of ACTIVITY_TABLES) {
            const { data, error } = await supabaseAdmin
                .from(table)
                .select('*')
                .gte('created_at', fromDate)
                .lte('created_at', toDate);

            if (!error && data) {
                data.forEach((row: any) => {
                    const channel = String(row.channel || '').toLowerCase();
                    const actionType = String(row.action_type || '').toLowerCase();
                    const status = String(row.status || '').toLowerCase();

                    const isEmail = channel.includes('email') || actionType.includes('email') || !!row.lead_email;
                    if (isEmail && channel !== 'voice' && channel !== 'whatsapp' && channel !== 'sms') {
                        grandTotalSent++;
                        tableStats[table].totalSent++;

                        const isReply = status.includes('reply') || actionType.includes('reply') || !!row.replied_at;
                        if (isReply) {
                            grandTotalReplies++;
                            tableStats[table].totalReplies++;
                        }

                        const isUnsub = status.includes('unsubscribed') || actionType.includes('unsubscribed');
                        if (isUnsub) {
                            grandTotalUnsubscribed++;
                            tableStats[table].totalUnsubscribed++;
                        }

                        if (row.created_at) {
                            const dateKey = new Date(row.created_at).toISOString().split('T')[0];
                            if (!dailyMap[dateKey]) {
                                dailyMap[dateKey] = { date: dateKey, sent: 0, replies: 0 };
                            }
                            dailyMap[dateKey].sent++;
                            if (isReply) dailyMap[dateKey].replies++;
                        }
                    }
                });
            }
        }

        const dailyHistory = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

        return NextResponse.json({
            totalSent: grandTotalSent,
            totalReplies: grandTotalReplies,
            totalUnsubscribed: grandTotalUnsubscribed,
            tableStats,
            dailyHistory,
        }, {
            headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
        });

    } catch (error: any) {
        console.error('Analytics API Route Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}

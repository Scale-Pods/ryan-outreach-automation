import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface WhatsappMetrics {
    totalReachouts: number;
    totalReplies: number;
    replyRate: number;
    dailyTrend: { date: string; reachouts: number; replies: number }[];
    ownerReachouts: number;
    ownerReplies: number;
}

export async function GET(): Promise<NextResponse> {
    const empty: WhatsappMetrics = {
        totalReachouts: 0,
        totalReplies: 0,
        replyRate: 0,
        dailyTrend: [],
        ownerReachouts: 0,
        ownerReplies: 0,
    };
    return NextResponse.json(empty, { headers: { 'Cache-Control': 'no-store' } });
}

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ customerId: string }> }
) {
    await params; // consume params
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
}

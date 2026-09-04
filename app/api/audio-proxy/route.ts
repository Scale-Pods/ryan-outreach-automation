import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const rawUrl = searchParams.get('url');

        if (!rawUrl) {
            return new NextResponse('Missing url parameter', { status: 400 });
        }

        // Extract clean http(s) URL if rawUrl contains titles or newlines
        const match = rawUrl.match(/https?:\/\/[^\s\)\"\']+/i);
        const targetUrl = match ? match[0] : rawUrl;

        // Pass along range header for audio seeking support
        const range = request.headers.get('range');
        const fetchHeaders: Record<string, string> = {};
        if (range) {
            fetchHeaders['range'] = range;
        }

        const audioRes = await fetch(targetUrl, { headers: fetchHeaders });

        if (!audioRes.ok && audioRes.status !== 206) {
            return new NextResponse(`Failed to fetch audio (${audioRes.status})`, { status: audioRes.status });
        }

        const responseHeaders = new Headers();
        const contentType = audioRes.headers.get('content-type') || 'audio/wav';
        const contentLength = audioRes.headers.get('content-length');
        const contentRange = audioRes.headers.get('content-range');
        const acceptRanges = audioRes.headers.get('accept-ranges') || 'bytes';

        responseHeaders.set('Content-Type', contentType);
        responseHeaders.set('Accept-Ranges', acceptRanges);
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set('Cache-Control', 'public, max-age=86400');

        if (contentLength) responseHeaders.set('Content-Length', contentLength);
        if (contentRange) responseHeaders.set('Content-Range', contentRange);

        const status = audioRes.status === 206 ? 206 : 200;

        return new NextResponse(audioRes.body, {
            status,
            headers: responseHeaders,
        });
    } catch (error: any) {
        console.error('Audio proxy error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

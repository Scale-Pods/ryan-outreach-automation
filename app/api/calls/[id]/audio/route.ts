import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const vapiPrivKey = process.env.VAPI_PRIVATE_KEY;
        const { id } = await context.params;

        if (vapiPrivKey) {
            console.log(`[AudioProxy] Attempting Vapi lookup for: ${id}`);
            const vapiRes = await fetch(`https://api.vapi.ai/call/${id}`, {
                headers: { 'Authorization': `Bearer ${vapiPrivKey}`, 'Content-Type': 'application/json' }
            });

            if (vapiRes.ok) {
                const callData = await vapiRes.json();
                const recordingUrl = callData.recordingUrl;
                if (recordingUrl) {
                    console.log(`[AudioProxy] Found Vapi Recording URL for ${id}: ${recordingUrl.substring(0, 40)}...`);
                    const audioRes = await fetch(recordingUrl, {
                        headers: {
                            ...(request.headers.get('Range') ? { 'Range': request.headers.get('Range')! } : {}),
                        }
                    });
                    if (audioRes.ok || audioRes.status === 206) {
                        const contentType = audioRes.headers.get('Content-Type');
                        const finalContentType = (contentType && contentType.includes('audio')) ? contentType : 'audio/mpeg';

                        console.log(`[AudioProxy] Streaming Vapi Audio: ${id}, Status: ${audioRes.status}, Type: ${finalContentType}`);
                        return new NextResponse(audioRes.body, {
                            status: audioRes.status,
                            headers: {
                                'Content-Type': finalContentType,
                                'Content-Length': audioRes.headers.get('Content-Length') || '',
                                'Accept-Ranges': 'bytes',
                                'Cache-Control': 'public, max-age=3600',
                                'Content-Disposition': `inline; filename="vapi-call-${id}.mp3"`,
                            },
                        });
                    } else {
                        console.warn(`[AudioProxy] Vapi Stream failure for ${id}: ${audioRes.status}`);
                    }
                } else {
                    console.warn(`[AudioProxy] Vapi call found but no recordingUrl: ${id}`);
                }
            } else {
                console.log(`[AudioProxy] Vapi lookup failed (${vapiRes.status}) for ${id}`);
            }
        }

        return NextResponse.json({ error: "Audio not found" }, { status: 404 });

    } catch (error) {
        console.error("Error proxying audio:", error);
        return NextResponse.json({ error: "Failed to fetch audio" }, { status: 500 });
    }
}

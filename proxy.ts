import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-change-this';
const secret = new TextEncoder().encode(JWT_SECRET);

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.includes('.')
    ) {
        return NextResponse.next();
    }

    const token = request.cookies.get('auth_token')?.value;

    if (pathname.startsWith('/dashboard')) {
        const isPublicChat = pathname.startsWith('/dashboard/whatsapp/chat/') && pathname.split('/').length > 4;

        if (isPublicChat) {
            return NextResponse.next();
        }

        if (!token) {
            const response = NextResponse.redirect(new URL('/', request.url));
            return response;
        }

        try {
            await jwtVerify(token, secret);
            return NextResponse.next();
        } catch (error) {
            console.error('Invalid token, redirecting:', error);
            const response = NextResponse.redirect(new URL('/', request.url));
            response.cookies.delete('auth_token');
            return response;
        }
    }

    if (pathname === '/' && token) {
        try {
            await jwtVerify(token, secret);
            return NextResponse.redirect(new URL('/dashboard', request.url));
        } catch (error) {
            // Token invalid, stay on landing page
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

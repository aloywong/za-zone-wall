import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookieValue } from '@/lib/site-auth';

export async function proxy(req: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;
  const authCookie = req.cookies.get('site-auth')?.value;
  const isLoggedIn = Boolean(
    sitePassword &&
      authCookie &&
      authCookie === (await getAuthCookieValue(sitePassword)),
  );
  const isLoginPage = req.nextUrl.pathname.startsWith('/login');
  const isApiLogin = req.nextUrl.pathname === '/api/login';
  const isPublicAsset = req.nextUrl.pathname === '/bg-video.mp4';

  if (!isLoggedIn && !isLoginPage && !isApiLogin && !isPublicAsset) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
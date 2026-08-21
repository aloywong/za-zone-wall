import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthCookieValue } from '@/lib/site-auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;
  const authCookie = req.cookies.get('site-auth')?.value;

  if (
    !sitePassword ||
    !authCookie ||
    authCookie !== (await getAuthCookieValue(sitePassword))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const paths = body?.paths;

  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ urls: {} });
  }

  const { data, error } = await supabaseAdmin.storage
    .from('wall-images')
    .createSignedUrls(paths, 60 * 60);

  if (error) {
    console.error('Signed URL error:', error);
    return NextResponse.json({ error: 'Unable to load media' }, { status: 500 });
  }

  const urlMap: Record<string, string> = {};
  data.forEach((item) => {
    if (item.path && item.signedUrl) {
      urlMap[item.path] = item.signedUrl;
    }
  });

  return NextResponse.json({ urls: urlMap });
}
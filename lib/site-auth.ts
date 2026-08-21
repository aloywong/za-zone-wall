const encoder = new TextEncoder();

export async function getAuthCookieValue(password: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(password));

  return Buffer.from(digest).toString('base64url');
}
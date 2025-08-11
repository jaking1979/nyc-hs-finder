export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : origin);

  const redirectTo = `${base}?unlocked=1`;

  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo },
  });
}
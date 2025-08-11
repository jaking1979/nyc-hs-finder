export const runtime = 'nodejs';
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return Response.redirect(`${baseUrl}/?unlocked=1`, 302);
}

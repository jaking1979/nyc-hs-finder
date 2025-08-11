export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get('from') || '';
    const to = url.searchParams.get('to') || '';
    const seed = `${from}|${to}`;
    let hash = 0; for (let i=0;i<seed.length;i++) hash = (hash*31 + seed.charCodeAt(i)) >>> 0;
    const minutes = 20 + (hash % 46); // 20..65
    return new Response(JSON.stringify({ minutes, source: 'stub' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error:'commute_error' }), { status: 500 });
  }
}

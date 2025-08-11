// src/app/api/pdf/route.ts
export const runtime = 'nodejs';
import { Buffer } from 'node:buffer';

export async function POST(req: Request) {
  try {
    const { profile, results, hiddenGems, commuteCap } = await req.json().catch(() => ({
      profile: {}, results: [], hiddenGems: [], commuteCap: 45,
    }));

    // Dynamic import to avoid ESM/CJS interop issues
    const PDFDocument = (await import('pdfkit')).default as any;

    const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
    const chunks: Uint8Array[] = [];

    return await new Promise<Response>((resolve, reject) => {
      doc.on('data', (c: Uint8Array) => chunks.push(c));
      doc.on('error', (e: any) => reject(e));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks as any);
        resolve(new Response(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="nyc-hs-guide.pdf"',
            'Cache-Control': 'no-store',
          },
        }));
      });

      // Minimal smoke-test content — we’ll swap in the full booklet after this works
      doc.fontSize(20).text('NYC High School Recommendations');
      doc.moveDown();
      doc.fontSize(12).fillColor('#374151').text('This is a smoke test PDF from /api/pdf');
      doc.moveDown();
      doc.fontSize(10).fillColor('#64748b').text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();
      doc.fontSize(10).fillColor('#111827').text(`Items: ${(results || []).length}`);
      doc.end();
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: 'pdf_failed', message: String(err?.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
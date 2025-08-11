/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// src/app/api/pdf/route.ts
export const runtime = 'nodejs';
import { Buffer } from 'node:buffer';

export async function POST(req: Request) {
  try {
    const { profile: _profile, results = [], hiddenGems: _hiddenGems, commuteCap: _commuteCap } = await req
      .json()
      .catch(() => ({ results: [] }));

    // Dynamic import to avoid ESM/CJS interop issues
    const PDFDocument = (await import('pdfkit')).default as any;

    const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
    const chunks: Uint8Array[] = [];

    return await new Promise<Response>((resolve, reject) => {
      doc.on('data', (c: Uint8Array) => chunks.push(c));
      doc.on('error', (e: unknown) => reject(e));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks as any);
        resolve(
          new Response(buffer, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': 'attachment; filename="nyc-hs-guide.pdf"',
              'Cache-Control': 'no-store',
            },
          })
        );
      });

      // Minimal smoke-test content — swap in full booklet after this works
      doc.fontSize(20).text('NYC High School Recommendations');
      doc.moveDown();
      doc.fontSize(12).fillColor('#374151').text('This is a smoke test PDF from /api/pdf');
      doc.moveDown();
      doc
        .fontSize(10)
        .fillColor('#64748b')
        .text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();
      doc.fontSize(10).fillColor('#111827').text(`Items: ${results.length}`);
      doc.end();
    });
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({ error: 'pdf_failed', message: String((err as Error)?.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
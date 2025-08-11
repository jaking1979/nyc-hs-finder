// src/app/api/pdf/route.ts
export const runtime = 'nodejs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

type SchoolSummary = { name?: string } & Record<string, unknown>;
type ResultItem = { school: SchoolSummary };

type Payload = {
  profile?: { weights?: Record<string, number>; summary?: string };
  results?: ResultItem[];
  hiddenGems?: unknown[];
  commuteCap?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Payload;

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]); // US Letter
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // Title
    page.drawText('NYC High School Recommendations', {
      x: 72, y: 720, size: 20, font: fontBold, color: rgb(0, 0, 0),
    });

    // Meta lines
    const meta: string[] = [
      `Generated: ${new Date().toLocaleString()}`,
      `Items: ${body.results?.length ?? 0}`,
      body.profile?.summary ? `Profile: ${body.profile.summary}` : '',
    ].filter(Boolean);

    meta.forEach((line, i) => {
      page.drawText(line, {
        x: 72, y: 690 - i * 16, size: 12, font, color: rgb(0.2, 0.2, 0.2),
      });
    });

    // List first few school names
    const names = (body.results ?? [])
      .slice(0, 5)
      .map((r) => String(r.school?.name ?? 'School'));

    names.forEach((name, i) => {
      page.drawText(`${i + 1}. ${name}`, {
        x: 72, y: 640 - i * 18, size: 12, font, color: rgb(0.1, 0.1, 0.1),
      });
    });

    const bytes = await pdf.save(); // Uint8Array
    const blob = new Blob([bytes], { type: 'application/pdf' }); // <-- fix

    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="nyc-hs-guide.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'pdf_failed', message: String((err as Error)?.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
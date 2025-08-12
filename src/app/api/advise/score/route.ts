import { NextResponse } from "next/server";
import { scorePrograms, DEFAULT_WEIGHTS, type ProgramRow, type SlotState, type ScoredProgram } from "../../../../types/scoring";
import { getProgramsWithMeta } from "../../../../lib/programsSource";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      slots: SlotState;
      weights?: Partial<typeof DEFAULT_WEIGHTS>;
      programs?: ProgramRow[]; // optional client override (debug)
    };

    const weights = { ...DEFAULT_WEIGHTS, ...(body.weights || {}) };

    // Choose source
    let list: ProgramRow[];
    let meta: { source: "remote" | "fallback" | "override"; url?: string; count: number; error?: string };

    if (body.programs && body.programs.length) {
      list = body.programs;
      meta = { source: "override", count: list.length };
    } else {
      const provided = await getProgramsWithMeta();
      list = provided.list;
      meta = provided.meta;
    }

    // Score
    const results = scorePrograms(list, body.slots, weights);

    // Enrich scored results with DOE program fields
    const byId = new Map<string, ProgramRow>();
    for (const p of list) byId.set(p.programId, p);

    const enriched: (ScoredProgram & {
      eligibilityText?: string;
      admissionsPriorities?: string[];
      programCode?: string;
      admissionsMethod?: string;
      tags?: string[];
    })[] = results.map((r) => {
      const src = byId.get(r.programId);
      return {
        ...r,
        admissionsMethod: src?.admissionsMethod ?? (r as any).admissionsMethod,
        tags: (r as any).tags ?? src?.programTags,
        eligibilityText: (src as any)?.eligibilityText,
        admissionsPriorities: (src as any)?.admissionsPriorities,
        programCode: (src as any)?.programCode,
      };
    });

    return NextResponse.json({
      ok: true,
      results: enriched,
      meta: {
        dataSource: meta.source,
        url: meta.url,
        programCount: meta.count,
        error: meta.error ?? undefined
      }
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}

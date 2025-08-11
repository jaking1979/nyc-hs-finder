import { NextResponse } from "next/server";
import { scorePrograms, DEFAULT_WEIGHTS, type ProgramRow, type SlotState } from "../../../../types/scoring";
import { getProgramsWithMeta } from "../../../../lib/programsSource";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      slots: SlotState;
      weights?: Partial<typeof DEFAULT_WEIGHTS>;
      programs?: ProgramRow[];
    };

    const weights = { ...DEFAULT_WEIGHTS, ...(body.weights || {}) };

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

    const results = scorePrograms(list, body.slots, weights);

    return NextResponse.json({
      ok: true,
      results,
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

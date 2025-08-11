import { NextResponse } from "next/server";
import { scorePrograms, DEFAULT_WEIGHTS, type ProgramRow, type SlotState } from "../../../../types/scoring";
import { getPrograms } from "../../../../lib/programsSource";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      slots: SlotState;
      weights?: Partial<typeof DEFAULT_WEIGHTS>;
      programs?: ProgramRow[]; // optional override from client for testing
    };

    const list = (body.programs && body.programs.length) ? body.programs : await getPrograms();
    const weights = { ...DEFAULT_WEIGHTS, ...(body.weights || {}) };
    const results = scorePrograms(list, body.slots, weights);
    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Bad request" }, { status: 400 });
  }
}

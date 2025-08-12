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

    // Normalize: if a program has no languages list, inherit from school-level language_classes
    for (const p of list) {
      const schoolLangs = (p as any)?.school?.languageClasses as string[] | undefined;
      if (!Array.isArray(schoolLangs)) continue;
      if ((!p.languages || p.languages.length === 0) && schoolLangs.length > 0) {
        p.languages = [...schoolLangs];
      }
    }

    // Normalize: infer artsTags from programTags + audition text + program name when missing
    for (const p of list) {
      const arts = (p as any).artsTags as string[] | undefined;
      if (Array.isArray(arts) && arts.length > 0) continue;

      const inferred = new Set<string>();
      const tags = (((p as any).programTags || []) as string[]);
      const auditionInfo = String((p as any)?.audition?.info || "");
      const nameInfo = String((p as any)?.programName || "");
      const lower = (auditionInfo + " " + nameInfo).toLowerCase();

      // Visual arts
      if (tags.includes("VisualArts")) {
        inferred.add("Visual portfolio");
      }

      // Performing arts – try to identify discipline from audition text or name
      if (tags.includes("PerformingArts") || lower.length > 0) {
        if (lower.includes("dance")) inferred.add("Dance");
        if (/(^|\W)(theater|theatre|drama)(\W|$)/.test(lower)) inferred.add("Theater");
        if (/(^|\W)(vocal|choral|sing)(\W|$)/.test(lower)) inferred.add("Vocal music");
        if (/(^|\W)(instrument|band|orchestra|jazz|piano|guitar|strings|winds|percussion)(\W|$)/.test(lower)) inferred.add("Instrumental music");
        // If performing arts is tagged but no specific discipline found, default to Theater
        if (tags.includes("PerformingArts") && inferred.size === 0) inferred.add("Theater");
      }

      if (inferred.size > 0) {
        (p as any).artsTags = Array.from(inferred);
      } else {
        // ensure consistent shape for scorer (empty array instead of undefined)
        (p as any).artsTags = [];
      }
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

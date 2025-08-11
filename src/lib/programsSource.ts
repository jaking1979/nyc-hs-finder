import type { ProgramRow } from "../types/scoring";
import fallback from "../data/programs.json";

export type ProgramsMeta = {
  source: "remote" | "fallback" | "override";
  url?: string;
  count: number;
  error?: string;
};

export async function getProgramsWithMeta(): Promise<{ list: ProgramRow[]; meta: ProgramsMeta }> {
  const url = process.env.PROGRAMS_JSON_URL;

  if (!url) {
    const list = fallback as ProgramRow[];
    return { list, meta: { source: "fallback", count: list.length } };
  }

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const list = (await res.json()) as ProgramRow[];
    if (!Array.isArray(list) || list.some(p => !p?.programId || !p?.schoolId || !p?.programName)) {
      throw new Error("Invalid ProgramRow[] shape");
    }
    return { list, meta: { source: "remote", url, count: list.length } };
  } catch (e: any) {
    const list = fallback as ProgramRow[];
    console.warn("[getProgramsWithMeta] Using fallback due to error:", e?.message || e);
    return { list, meta: { source: "fallback", url, count: list.length, error: String(e?.message || e) } };
  }
}

export async function getPrograms(): Promise<ProgramRow[]> {
  const { list } = await getProgramsWithMeta();
  return list;
}

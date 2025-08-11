import type { ProgramRow } from "../types/scoring";
import fallback from "../data/programs.sample";

// Load from a remote JSON (array of ProgramRow), cached for 24h on Vercel.
// If PROGRAMS_JSON_URL is not set or fetch fails, use the local fallback.
export async function getPrograms(): Promise<ProgramRow[]> {
  const url = process.env.PROGRAMS_JSON_URL;
  if (!url) return fallback as ProgramRow[];

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } }); // 24h
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = (await res.json()) as ProgramRow[];
    // very light validation: require programId + schoolId + name
    if (!Array.isArray(data) || data.some(p => !p?.programId || !p?.schoolId || !p?.programName)) {
      throw new Error("Invalid ProgramRow[] shape");
    }
    return data;
  } catch (e) {
    console.warn("[getPrograms] Using fallback due to error:", e);
    return fallback as ProgramRow[];
  }
}

import type { ScoredProgram } from "../../types/scoring";

export function labelAdmissions(s: string|undefined){
  if(!s) return "Admissions: Other";
  const t = s.toLowerCase();
  if(t.includes("audition")) return "Audition";
  if(t.includes("screen")) return "Screened";
  if(t.includes("edopt")) return "Educational Option";
  if(t.includes("open")) return "Open";
  if(t.includes("zone")) return "Zoned";
  return "Other";
}

export function renderProgramMeta(p: ScoredProgram ScoredProgram) { admissionsMethod?: string; tags?: string[] }){
  const lines: string[] = [];
  lines.push(`${labelAdmissions(p.admissionsMethod)} · Score ${p.score}`);
  if (p.tags?.length) lines.push(p.tags.slice(0,3).join(" • "));
  return lines.join(" — ");
}

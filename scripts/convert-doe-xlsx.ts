import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

// ---------- Types used for output JSON (safe superset; your app only requires id/name/school) ----------
type Borough = "Manhattan"|"Brooklyn"|"Queens"|"Bronx"|"Staten Island";
type AdmissionsMethod = "Open"|"Screened"|"Audition"|"EdOpt"|"Zoned"|"Other";

interface ProgramRow {
  programId: string;          // e.g., K445B
  schoolId: string;           // DBN, e.g., K445
  programName: string;        // e.g., STEM Honors
  schoolName: string;
  borough: Borough;
  admissionsMethod: AdmissionsMethod;

  // existing fields your app already uses (optional in JSON)
  programTags?: string[];
  hasIEPSupports?: boolean;
  hasELLSupports?: boolean;
  accessibilityNotes?: string[];
  schoolSize?: number;
  gradRate?: number;
  attendanceRate?: number;
  surveySatisfaction?: number;
  dataAsOf: string;

  // NEW helpful fields (extra info — your app ignores these unless you choose to use them)
  programCode?: string;                             // DOE program code `codeN`
  eligibilityText?: string;                         // `eligibilityN`
  admissionsPriorities?: string[];                  // admissionspriority{1..3}{N}
  audition?: { common?: boolean; info?: string } | null;
  specialized?: boolean;
  seats?: {
    ge?: number; swd?: number;                   // seats9geN / seats9swdN
    tenthGrade?: number | null;                  // seats10N (seats101..seats1011)
  };
  applicants?: {
    ge?: number; swd?: number;                   // grade9geapplicantsN / grade9swdapplicantsN
    gePerSeat?: number; swdPerSeat?: number;     // grade9geapplicantsperseatN / swd...
  };
  school: {
    url?: string; website?: string; neighborhood?: string;
    ellPrograms?: string[]; languageClasses?: string[];
    psalSports?: { boys?: string[]; girls?: string[]; coed?: string[] };
    schoolSports?: string[];
    address?: { line1?: string; city?: string; state?: string; zip?: string };
    transit?: { subway?: string[]; bus?: string[] };
  };
}

// ---------- helpers ----------
const splitList = (v:any) => !v ? undefined :
  String(v).split(/[;,]/).map(s=>s.trim()).filter(Boolean);
const booly = (v:any) => ["y","yes","true","1","t"].includes(String(v||"").trim().toLowerCase());
const pct01 = (v:any): number|undefined => {
  if (v==null||v==="") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? (n>1?Math.min(1,Math.max(0,n/100)):Math.min(1,Math.max(0,n))) : undefined;
};
const mapAdmissions = (v:any): AdmissionsMethod => {
  const s = String(v||"").toLowerCase();
  if (s.includes("audition")) return "Audition";
  if (s.includes("screen")) return "Screened";
  if (s.includes("edopt") || s.includes("educational option")) return "EdOpt";
  if (s.includes("zone")) return "Zoned";
  if (s.includes("open")) return "Open";
  return "Other";
};
const mapBoro = (b:any): Borough => {
  const s=String(b||"").trim().toUpperCase();
  if (s==="M"||/MANH/i.test(s)) return "Manhattan";
  if (s==="K"||/BROOK/i.test(s)) return "Brooklyn";
  if (s==="Q"||/QUEEN/i.test(s)) return "Queens";
  if (s==="X"||/BRONX/i.test(s)) return "Bronx";
  if (s==="R"||/STATEN/i.test(s)) return "Staten Island";
  return "Brooklyn";
};

// ---------- CLI args ----------
const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k,v] = a.split("="); return [k.replace(/^--/,""), v ?? true];
}));
const IN = String(args["in"] || "data/hs-directory.xlsx");
const OUT = String(args["out"] || "src/data/programs.json");

// ---------- main ----------
(function run() {
  const file = path.resolve(IN);
  if (!fs.existsSync(file)) { console.error(`Input file not found: ${file}`); process.exit(1); }
  const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });

  // Always use the "Data" sheet
  const ws = wb.Sheets["Data"] || wb.Sheets[wb.SheetNames.find(n => n.toLowerCase().includes("data")) || wb.SheetNames[0]];
  if (!ws) throw new Error("No worksheets found.");
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
  if (!rows.length) throw new Error("“Data” sheet has no rows.");

  // Determine how many programs appear (1..11) by scanning for programN headers
  const headerSet = new Set<string>(Object.keys(rows[0]));
  const indices = Array.from(new Set(
    [...headerSet]
      .map(k => k.match(/^program(\d{1,2})$/i)?.[1])
      .filter(Boolean)
      .map(Number)
  )).sort((a,b)=>a-b);
  const programIndices = indices.length ? indices : [1];

  const today = new Date().toISOString().slice(0,10);
  const out: ProgramRow[] = [];

  for (const r of rows) {
    const dbn = String(r["dbn"] || "").trim();
    const schoolName = String(r["school_name"] || "").trim() || "School";
    const borough = mapBoro(r["boro"]);

    for (const i of programIndices) {
      const name = String(r[`program${i}`] || "").trim();
      const method = r[`method${i}`];
      const interest = r[`interest${i}`];             // tag-ish
      const code = r[`code${i}`];                     // program code (unique)
      const elig = r[`eligibility${i}`];

      // Skip slots with no signal at all
      const hasSignal = !!name || !!method || !!interest || !!code || !!elig;
      if (!hasSignal) continue;

      // admissions priorities: admissionspriority{1..3}{i}
      const priorities: string[] = [];
      const p1 = r[`admissionspriority1${i}`];
      const p2 = r[`admissionspriority2${i}`];
      const p3 = r[`admissionspriority3${i}`];
      if (p1) priorities.push(String(p1).trim());
      if (p2) priorities.push(String(p2).trim());
      if (p3) priorities.push(String(p3).trim());

      // seats/applicants/pressure
      const geApps  = Number(r[`grade9geapplicants${i}`]) || undefined;
      const swdApps = Number(r[`grade9swdapplicants${i}`]) || undefined;
      const geSeats = Number(r[`seats9ge${i}`]) || undefined;
      const swdSeats= Number(r[`seats9swd${i}`]) || undefined;
      const geAPS   = Number(r[`grade9geapplicantsperseat${i}`]) || undefined;
      const swdAPS  = Number(r[`grade9swdapplicantsperseat${i}`]) || undefined;

      // 10th grade seats
      const tenthSeats = Number(r[`seats10${i}`] || r[`seats101${i===1?"" : i}`]) || undefined; // data dictionary uses seats101..seats1011

      // audition info
      const commonAudit = booly(r[`common_audition${i}`]);
      const auditInfo   = String(r[`auditioninformation${i}`] || "").trim();
      const audition = (commonAudit || auditInfo) ? { common: !!commonAudit, info: auditInfo || undefined } : null;

      // Normalize tags from interest
      const tagsRaw = splitList(interest) || [];
      const normalizedTags = tagsRaw.map(t => {
        const s = t.toLowerCase();
        if (s.includes("stem") || s.includes("engineering") || s.includes("comp")) return "STEM";
        if (s.includes("health") || s.includes("bio") || s.includes("medical")) return "Health";
        if (s.includes("visual")) return "VisualArts";
        if (s.includes("perform") || s.includes("theater") || s.includes("music") || s.includes("dance")) return "PerformingArts";
        if (s.includes("humanities") || s.includes("law") || s.includes("journal")) return "Humanities";
        if (s.includes("cte") || s.includes("career") || s.includes("tech")) return "CTE-Tech";
        return t;
      });

      const programId = String(code || (dbn ? `${dbn}-P${i}` : `UNK-P${i}`));
      const programName = name || `${schoolName} – Program ${i}`;
      const admissionsMethod = mapAdmissions(method);

      const row: ProgramRow = {
        programId,
        schoolId: dbn || "UNK",
        programName,
        schoolName,
        borough,
        admissionsMethod,
        programTags: normalizedTags.length ? normalizedTags : undefined,
        dataAsOf: today,

        programCode: code ? String(code) : undefined,
        eligibilityText: elig ? String(elig) : undefined,
        admissionsPriorities: priorities.length ? priorities : undefined,
        audition,

        specialized: booly(r["specialized"]),

        seats: (geSeats||swdSeats||tenthSeats) ? { ge: geSeats, swd: swdSeats, tenthGrade: tenthSeats ?? null } : undefined,
        applicants: (geApps||swdApps||geAPS||swdAPS) ? { ge: geApps, swd: swdApps, gePerSeat: geAPS, swdPerSeat: swdAPS } : undefined,

        // school-level info (handy later)
        school: {
          url: r["url"] || undefined,
          website: r["website"] || undefined,
          neighborhood: r["neighborhood"] || undefined,
          ellPrograms: splitList(r["ell_programs"]),
          languageClasses: splitList(r["language_classes"]),
          psalSports: {
            boys: splitList(r["psal_sports_boys"]),
            girls: splitList(r["psal_sports_girls"]),
            coed: splitList(r["psal_sports_coed"]),
          },
          schoolSports: splitList(r["school_sports"]),
          address: {
            line1: r["primary_address_line_1"] || undefined,
            city: r["city"] || undefined,
            state: r["state_code"] || undefined,
            zip: r["zip"] || undefined,
          },
          transit: {
            subway: splitList(r["subway"]),
            bus: splitList(r["bus"]),
          }
        },

        // light proxies so your scoring works until you wire real sources:
        hasIEPSupports: !!r["ell_programs"] || !!r["language_classes"], // heuristic until we add true flags
        hasELLSupports: !!r["ell_programs"],                            // heuristic
        accessibilityNotes: splitList(r["school_accessibility_description"]),
        schoolSize: Number(r["total_students"]) || undefined,
        gradRate: pct01(r["graduation_rate"]),
        attendanceRate: pct01(r["attendance_rate"]),
        surveySatisfaction: pct01(r["pct_stu_enough_variety"]), // or pct_stu_safe; both are in dict
      };

      out.push(row);
    }
  }

  fs.writeFileSync(path.resolve(OUT), JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} programs to ${OUT}`);
})();

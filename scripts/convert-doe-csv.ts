/**
 * Convert a DOE-style CSV to ProgramRow[] JSON for the Advisor.
 * Usage:
 *   npx ts-node scripts/convert-doe-csv.ts \
 *     --in data/doe.csv \
 *     --out src/data/programs.json
 */

import { createReadStream, writeFileSync } from "fs";
import { parse } from "csv-parse";
import * as path from "path";

type Borough = "Manhattan"|"Brooklyn"|"Queens"|"Bronx"|"Staten Island";
type AdmissionsMethod = "Open"|"Screened"|"Audition"|"EdOpt"|"Zoned"|"Other";

interface ProgramRow {
  programId: string;
  schoolId: string;
  programName: string;
  schoolName: string;
  borough: Borough;
  latitude?: number;
  longitude?: number;

  admissionsMethod: AdmissionsMethod;
  isSpecializedHS?: boolean;
  usesDIA?: boolean;
  hasInclusion?: boolean;

  programTags: string[];        // e.g. ["STEM","Health","Humanities","PerformingArts","VisualArts","CTE-Tech"]
  artsTags?: string[];          // freeform like ["orchestra","visual-portfolio"]
  sports?: string[];
  languages?: string[];
  apCourses?: string[];

  hasIEPSupports?: boolean;
  hasELLSupports?: boolean;
  accessibilityNotes?: string[];

  schoolSize?: number;
  campusType?: "Traditional"|"Campus"|"Career-CTE"|null;
  singleSex?: boolean;
  pedagogyStyle?: "Traditional"|"Progressive"|null;

  gradRate?: number;                // 0..1
  attendanceRate?: number;          // 0..1
  surveySatisfaction?: number;      // 0..1
  boroughGradRateMedian?: number;   // 0..1
  boroughAttendanceMedian?: number; // 0..1

  estCommuteMins?: number;          // leave blank for now
  dataAsOf: string;                 // ISO date
}

// ---------- CONFIG: map your CSV column names here ----------
const C = {
  programId: "PROGRAM_ID",
  schoolId: "DBN",                        // e.g., 'K485'
  programName: "PROGRAM_NAME",
  schoolName: "SCHOOL_NAME",
  borough: "BOROUGH",                     // Manhattan/Brooklyn/Queens/Bronx/Staten Island
  lat: "LATITUDE",
  lon: "LONGITUDE",

  admissionsMethod: "ADMISSIONS_METHOD",  // Open/Screened/Audition/EdOpt/Zoned
  isSpecializedHS: "SPECIALIZED",         // true/false or Y/N
  usesDIA: "DIA",                         // true/false or Y/N
  hasInclusion: "INCLUSION_AVAILABLE",    // true/false or Y/N

  programTags: "PROGRAM_FOCUS",           // comma list like "STEM, Health"
  artsTags: "ARTS",                       // "orchestra; band; visual-portfolio"
  sports: "SPORTS",                       // semicolon list
  languages: "LANGUAGES",                 // comma list
  apCourses: "AP_COURSES",                // comma list

  hasIEP: "IEP_SUPPORTS",                 // true/false or Y/N
  hasELL: "ELL_SUPPORTS",                 // true/false or Y/N
  accessibility: "ACCESS_NOTES",          // semicolon list

  schoolSize: "ENROLLMENT",
  campusType: "CAMPUS_TYPE",              // Traditional/Campus/Career-CTE
  singleSex: "SINGLE_SEX",                // true/false or Boys/Girls/Coed
  pedagogyHint: "PEDAGOGY",               // Traditional/Progressive/Project-based/etc.

  gradRate: "GRAD_RATE",                  // percent like 88 or 0.88
  attendance: "ATTEND_RATE",              // percent like 92 or 0.92
  survey: "SURVEY_SATISFACTION",          // 0..1
  dataAsOf: "DATA_AS_OF",                 // ISO or yyyy-mm
} as const;

// Borough medians (rough placeholders; adjust if you have better values)
const BOROUGH_MEDIANS = {
  "Manhattan":   { grad: 0.84, attend: 0.88 },
  "Brooklyn":    { grad: 0.84, attend: 0.88 },
  "Queens":      { grad: 0.87, attend: 0.91 },
  "Bronx":       { grad: 0.78, attend: 0.85 },
  "Staten Island": { grad: 0.89, attend: 0.92 },
} as const;

// ---------- helpers ----------
const booly = (v: any) => {
  if (v == null) return false;
  const s = String(v).trim().toLowerCase();
  return ["y","yes","true","1","t"].includes(s);
};

const numOr = (v: any, def?: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const pct01 = (v: any): number|undefined => {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  // if it's >1, assume it's 0..100
  return n > 1 ? Math.min(1, Math.max(0, n/100)) : Math.min(1, Math.max(0, n));
};

const splitList = (v: any): string[]|undefined => {
  if (!v) return undefined;
  const s = String(v);
  const delim = s.includes(";") ? ";" : ",";
  return s.split(delim).map(x => x.trim()).filter(Boolean);
};

const mapAdmissions = (v: any): AdmissionsMethod => {
  const s = String(v||"").toLowerCase();
  if (s.includes("audition")) return "Audition";
  if (s.includes("screen")) return "Screened";
  if (s.includes("edopt") || s.includes("educational option")) return "EdOpt";
  if (s.includes("zone")) return "Zoned";
  if (s.includes("open")) return "Open";
  return "Other";
};

const mapPedagogy = (v: any): "Traditional"|"Progressive"|null => {
  const s = String(v||"").toLowerCase();
  if (!s) return null;
  if (s.includes("project") || s.includes("inquiry") || s.includes("portfolio") || s.includes("progress"))
    return "Progressive";
  return "Traditional";
};

const mapProgramTags = (v: any): string[] => {
  const list = splitList(v) || [];
  // normalize common tags a bit
  return list.map(tag => {
    const s = tag.toLowerCase();
    if (s.includes("stem") || s.includes("engineering") || s.includes("comp")) return "STEM";
    if (s.includes("health") || s.includes("bio") || s.includes("medical")) return "Health";
    if (s.includes("visual")) return "VisualArts";
    if (s.includes("perform") || s.includes("theater") || s.includes("music") || s.includes("dance")) return "PerformingArts";
    if (s.includes("humanities") || s.includes("law") || s.includes("journal")) return "Humanities";
    if (s.includes("cte") || s.includes("career") || s.includes("tech")) return "CTE-Tech";
    return tag;
  });
};

// ---------- run ----------
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.split("=");
  return [k.replace(/^--/,""), v ?? true];
}));

const IN = args["in"] || "data/doe.csv";
const OUT = args["out"] || "src/data/programs.json";

(async () => {
  const rows: any[] = [];
  await new Promise<void>((resolve, reject) => {
    createReadStream(path.resolve(IN))
      .pipe(parse({ columns: true, bom: true, trim: true }))
      .on("data", (rec) => rows.push(rec))
      .on("end", () => resolve())
      .on("error", reject);
  });

  const out: ProgramRow[] = rows.map((r) => {
    const borough = String(r[C.borough] || "").trim() as Borough;
    const med = BOROUGH_MEDIANS[borough as keyof typeof BOROUGH_MEDIANS] ?? BOROUGH_MEDIANS["Brooklyn"];

    return {
      programId: String(r[C.programId] || `${r[C.schoolId]}-UNK`),
      schoolId: String(r[C.schoolId] || ""),
      programName: String(r[C.programName] || "Program"),
      schoolName: String(r[C.schoolName] || "School"),
      borough: borough || "Brooklyn",
      latitude: numOr(r[C.lat]),
      longitude: numOr(r[C.lon]),

      admissionsMethod: mapAdmissions(r[C.admissionsMethod]),
      isSpecializedHS: booly(r[C.isSpecializedHS]),
      usesDIA: booly(r[C.usesDIA]),
      hasInclusion: booly(r[C.hasInclusion]),

      programTags: mapProgramTags(r[C.programTags]),
      artsTags: splitList(r[C.artsTags]),
      sports: splitList(r[C.sports]),
      languages: splitList(r[C.languages]),
      apCourses: splitList(r[C.apCourses]),

      hasIEPSupports: booly(r[C.hasIEP]),
      hasELLSupports: booly(r[C.hasELL]),
      accessibilityNotes: splitList(r[C.accessibility]),

      schoolSize: numOr(r[C.schoolSize]),
      campusType: ((): any => {
        const s = String(r[C.campusType] || "").toLowerCase();
        if (s.includes("career") || s.includes("cte")) return "Career-CTE";
        if (s.includes("campus")) return "Campus";
        if (s) return "Traditional";
        return null;
      })(),
      singleSex: ((): boolean|undefined => {
        const s = String(r[C.singleSex] || "").toLowerCase();
        if (!s) return undefined;
        if (["boys","girls","single-sex","single sex","true","y"].includes(s)) return true;
        if (["coed","false","n","no"].includes(s)) return false;
        return undefined;
      })(),
      pedagogyStyle: mapPedagogy(r[C.pedagogyHint]),

      gradRate: pct01(r[C.gradRate]),
      attendanceRate: pct01(r[C.attendance]),
      surveySatisfaction: pct01(r[C.survey]),
      boroughGradRateMedian: med.grad,
      boroughAttendanceMedian: med.attend,

      dataAsOf: ((): string => {
        const raw = String(r[C.dataAsOf] || "").trim();
        if (!raw) return new Date().toISOString().slice(0,10);
        // normalize yyyy-mm to yyyy-mm-01 if needed
        if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
        return raw;
      })(),
    };
  });

  writeFileSync(path.resolve(OUT), JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} programs to ${OUT}`);
})();

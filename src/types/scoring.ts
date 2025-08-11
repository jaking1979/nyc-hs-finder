// =============================================
// NYC HS Advisor — Self‑contained scoring module
// Types + weight presets + scoring logic in one file
// =============================================

// ---------- Types ----------
export type Borough = "Manhattan"|"Brooklyn"|"Queens"|"Bronx"|"Staten Island";
export type AdmissionsMethod = "Open"|"Screened"|"Audition"|"EdOpt"|"Zoned"|"Other";
export type AdmissionsOptOut = "allow_all" | "no_audition" | "no_screened";
export type SupportNeed = "IEP" | "ELL" | "Accessibility";
export type ProgramInterest =
  | "STEM" | "Health" | "IB" | "Humanities" | "PerformingArts" | "VisualArts"
  | "CTE-Tech" | "CTE-Media" | "CTE-Culinary" | "WorldLanguages" | "Business" | "Other";

export interface SlotState {
  // Where
  boroughs: Borough[];                              // e.g., ["Brooklyn","Queens"]
  homeHint?: { crossSt?: string; subwayStop?: string };

  // Constraints / prefs
  commuteCapMins: number;                           // hard cap; e.g., 60
  admissionsOptOut: AdmissionsOptOut;               // exclude certain methods if desired
  programInterests: ProgramInterest[];              // ordered by priority
  mustHaves: {
    sports?: string[];
    arts?: string[];                                // e.g., ["orchestra","theater"]
    languages?: string[];                           // e.g., ["Spanish","Mandarin"]
    apCourses?: string[];                           // e.g., ["AP Biology"]
  };
  supportNeeds: SupportNeed[];                      // e.g., ["IEP","ELL"]
  schoolSizePref?: "Small"|"Medium"|"Large"|null;
  environmentPrefs?: {
    campusType?: "Traditional"|"Campus"|"Career-CTE"|null;
    singleSexOk?: boolean;
    pedagogy?: "Traditional"|"Progressive"|"Either"|null;
  };

  // Comfort / profile (optional — never request PII)
  okWithAuditions?: boolean;
  okWithScreened?: boolean;
  academicBand?: "Developing"|"Proficient"|"Advanced"|null;
  considerSHSAT?: boolean;
  shsatBand?: "Low"|"Mid"|"High"|null;

  // Eligibility flags
  diversityEligible?: boolean;                      // for DIA priorities
  iepInclusionRequired?: boolean;                   // must have ICT/inclusion if true

  // Hard excludes
  excludes?: string[];                              // program IDs removed by the user
}

export interface WeightModel {
  ProgramFit: number;   // 0–1
  Commute: number;      // 0–1
  Supports: number;     // 0–1
  Outcomes: number;     // 0–1
  Environment: number;  // 0–1
}

export interface ScoredProgram {
  programId: string;
  schoolId: string;
  name: string;                                     // program name
  schoolName: string;
  admissionMethod: AdmissionsMethod;
  estCommuteMins?: number;
  score: number;                                    // 0–100
  pillars: {
    ProgramFit: number;                             // contribution in 0–100 scale
    Commute: number;
    Supports: number;
    Outcomes: number;
    Environment: number;
    penalties: number;                              // negative total (0 to -100)
  };
  rationale: string;                                // 1–2 sentence Zagat‑style blurb
  dataAsOf: string;                                 // ISO date for transparency
}

// A normalized program row from your ETL (DOE HS Directory + School Quality + curated flags)
export interface ProgramRow {
  programId: string;
  schoolId: string;
  programName: string;
  schoolName: string;
  borough: Borough;
  latitude?: number;                                 // for commute calc (later)
  longitude?: number;

  // Admissions
  admissionsMethod: AdmissionsMethod;
  isSpecializedHS?: boolean;
  usesDIA?: boolean;                                  // Diversity in Admissions set‑asides
  hasInclusion?: boolean;                             // ICT/inclusion availability

  // Program & offerings
  programTags: ProgramInterest[];                     // e.g., ["STEM","CTE-Tech"]
  artsTags?: string[];                                // e.g., ["orchestra","visual-portfolio"]
  sports?: string[];
  languages?: string[];                               // taught languages
  apCourses?: string[];

  // Supports & accessibility
  hasIEPSupports?: boolean;                           // coarse flag
  hasELLSupports?: boolean;
  accessibilityNotes?: string[];                      // elevator, ramp, etc.

  // Environment
  schoolSize?: number;                                // total enrollment
  campusType?: "Traditional"|"Campus"|"Career-CTE"|null;
  singleSex?: boolean;
  pedagogyStyle?: "Traditional"|"Progressive"|null; // derived rubric

  // Outcomes (normalized values 0..1)
  gradRate?: number;
  attendanceRate?: number;
  surveySatisfaction?: number;                        // 0..1 (student/parent survey composite)
  boroughGradRateMedian?: number;                     // for context
  boroughAttendanceMedian?: number;

  // Computed by your ETL or commute service
  estCommuteMins?: number;                            // arrival 8:00–8:30 heuristic
  dataAsOf: string;                                   // ISO date stamp per record
}

// ---------- Default weights & presets ----------
export const DEFAULT_WEIGHTS: WeightModel = {
  ProgramFit: 0.34,
  Commute:    0.22,
  Supports:   0.18,
  Outcomes:   0.18,
  Environment:0.08,
};

export const WEIGHT_PRESETS = {
  Balanced: DEFAULT_WEIGHTS,
  ShortCommute:    { ProgramFit:0.28, Commute:0.32, Supports:0.16, Outcomes:0.18, Environment:0.06 },
  IEP_Priority:    { ProgramFit:0.28, Commute:0.18, Supports:0.32, Outcomes:0.16, Environment:0.06 },
  Arts_Forward:    { ProgramFit:0.38, Commute:0.18, Supports:0.16, Outcomes:0.20, Environment:0.08 },
  Outcomes_First:  { ProgramFit:0.26, Commute:0.18, Supports:0.16, Outcomes:0.34, Environment:0.06 },
} as const;

// ---------- Scoring logic ----------
const clamp01 = (x:number)=> Math.max(0, Math.min(1, x));

export function scorePrograms(
  programs: ProgramRow[],
  slots: SlotState,
  w: WeightModel
): ScoredProgram[] {
  return programs
    .filter(p => filterByHardRules(p, slots))
    .map(p => {
      const programFit = computeProgramFit(p, slots);        // 0–1
      const commute    = computeCommuteFit(p, slots);        // 0–1
      const supports   = computeSupportsFit(p, slots);       // 0–1
      const outcomes   = computeOutcomesFit(p);              // 0–1
      const env        = computeEnvironmentFit(p, slots);    // 0–1

      let penalties = 0;
      if (slots.admissionsOptOut === "no_audition" && p.admissionsMethod === "Audition") penalties -= 0.15;
      if (slots.admissionsOptOut === "no_screened" && p.admissionsMethod === "Screened") penalties -= 0.10;
      if (slots.commuteCapMins && (p.estCommuteMins ?? 999) > slots.commuteCapMins) penalties -= 0.25;
      if (slots.excludes?.includes(p.programId)) penalties -= 1;

      const raw =
        w.ProgramFit * programFit +
        w.Commute    * commute +
        w.Supports   * supports +
        w.Outcomes   * outcomes +
        w.Environment* env +
        penalties;

      const score = Math.round(clamp01(raw) * 100);

      return {
        programId: p.programId,
        schoolId: p.schoolId,
        name: p.programName,
        schoolName: p.schoolName,
        admissionMethod: p.admissionsMethod,
        estCommuteMins: p.estCommuteMins,
        score,
        pillars: {
          ProgramFit: Math.round(programFit * w.ProgramFit * 100),
          Commute:    Math.round(commute    * w.Commute    * 100),
          Supports:   Math.round(supports   * w.Supports   * 100),
          Outcomes:   Math.round(outcomes   * w.Outcomes   * 100),
          Environment:Math.round(env        * w.Environment* 100),
          penalties:  Math.round(penalties * 100),
        },
        rationale: buildZagatBlurb(p, { programFit, supports, commute, outcomes }),
        dataAsOf: p.dataAsOf,
      };
    })
    .sort((a,b)=> b.score - a.score);
}

// ---------- HARD FILTERS ----------
function filterByHardRules(p: ProgramRow, s: SlotState){
  if (s.iepInclusionRequired && !p.hasInclusion) return false;
  if (s.environmentPrefs?.singleSexOk === false && p.singleSex) return false;
  if (s.boroughs?.length && !s.boroughs.includes(p.borough)) return false;

  // Must-haves (require presence of all selected items where provided)
  if (s.mustHaves?.arts?.length){
    const hit = s.mustHaves.arts.every(tag => p.artsTags?.includes(tag));
    if (!hit) return false;
  }
  if (s.mustHaves?.sports?.length){
    const hit = s.mustHaves.sports.every(tag => (p.sports||[]).includes(tag));
    if (!hit) return false;
  }
  if (s.mustHaves?.languages?.length){
    const hit = s.mustHaves.languages.some(l => (p.languages||[]).includes(l));
    if (!hit) return false;
  }
  if (s.mustHaves?.apCourses?.length){
    const hit = s.mustHaves.apCourses.every(c => (p.apCourses||[]).includes(c));
    if (!hit) return false;
  }

  return true;
}

// ---------- PILLAR COMPUTATIONS ----------
function computeProgramFit(p: ProgramRow, s: SlotState){
  // Weighted overlap of ordered interests
  let fit = 0.5;
  if (s.programInterests?.length){
    const weights = s.programInterests.map((_,i)=> 1/(i+1));
    const sumW = weights.reduce((a,b)=>a+b,0);
    const hit = s.programInterests.reduce((acc,interest,idx)=> acc + (p.programTags?.includes(interest) ? weights[idx] : 0), 0);
    fit = clamp01(hit / sumW);
  }

  // Arts "must-haves" can add a small bump if fully satisfied
  if (s.mustHaves?.arts?.length){
    const all = s.mustHaves.arts.every(tag => p.artsTags?.includes(tag));
    if (all) fit = Math.min(1, fit + 0.1);
  }

  // Diversity in Admissions preference boost (does not imply eligibility or guarantee)
  if (s.diversityEligible && p.usesDIA) fit = Math.min(1, fit + 0.06);

  return fit;
}

function computeCommuteFit(p: ProgramRow, s: SlotState){
  if (!p.estCommuteMins) return 0.5; // until real commute is wired
  const cap = s.commuteCapMins || 90;
  const x = Math.min(p.estCommuteMins, cap);
  const fit = 1 - (x / cap) * 0.8; // within-cap stays between 0.2 and 1.0
  return clamp01(fit);
}

function computeSupportsFit(p: ProgramRow, s: SlotState){
  let fit = 0.5;
  if (s.supportNeeds?.includes("IEP")){
    if (p.hasInclusion || p.hasIEPSupports) fit += 0.25; else fit -= 0.25;
  }
  if (s.supportNeeds?.includes("ELL")){
    if (p.hasELLSupports) fit += 0.2; else fit -= 0.2;
  }
  if (s.supportNeeds?.includes("Accessibility")){
    const accessible = (p.accessibilityNotes||[]).length > 0; // TODO: refine rubric
    fit += accessible ? 0.1 : -0.1;
  }
  return clamp01(fit);
}

function computeOutcomesFit(p: ProgramRow){
  const grad = ratioVsMedian(p.gradRate, p.boroughGradRateMedian);   // 0..1
  const attend = ratioVsMedian(p.attendanceRate, p.boroughAttendanceMedian);
  const survey = clamp01(p.surveySatisfaction ?? 0.5);
  return clamp01(0.5*grad + 0.3*attend + 0.2*survey);
}

function computeEnvironmentFit(p: ProgramRow, s: SlotState){
  let env = 0.5;
  // Size preference
  if (s.schoolSizePref && p.schoolSize){
    const sizeBand = p.schoolSize < 600 ? "Small" : p.schoolSize <= 1200 ? "Medium" : "Large";
    env += (sizeBand === s.schoolSizePref) ? 0.15 : -0.1;
  }
  // Campus type
  if (s.environmentPrefs?.campusType && p.campusType){
    env += (s.environmentPrefs.campusType === p.campusType) ? 0.08 : -0.04;
  }
  // Pedagogy alignment
  if (s.environmentPrefs?.pedagogy && s.environmentPrefs.pedagogy !== "Either" && p.pedagogyStyle){
    const match = s.environmentPrefs.pedagogy === p.pedagogyStyle;
    env += match ? 0.12 : -0.08;
  }
  return clamp01(env);
}

// ---------- Helpers ----------
function ratioVsMedian(val?: number, med?: number){
  if (val == null) return 0.5;
  if (med == null || med === 0) return clamp01(val);
  const ratio = val / med; // e.g., 1.10 = 10% above median
  const mapped = 0.5 + (ratio - 1) * 0.5; // 20% over -> +0.1
  return clamp01(mapped);
}

function buildZagatBlurb(p: ProgramRow, parts:{programFit:number;supports:number;commute:number;outcomes:number;}): string {
  const bits:string[] = [];
  if (parts.programFit > 0.7) bits.push(`${p.programName} aligns with your interests`);
  if (parts.supports   > 0.6) bits.push(`robust student supports${p.hasInclusion?" (inclusion)":""}`);
  if (parts.commute    > 0.6 && p.estCommuteMins) bits.push(`~${p.estCommuteMins}‑min morning commute`);
  if (parts.outcomes   > 0.6 && p.gradRate && p.boroughGradRateMedian){
    const delta = Math.round((p.gradRate - p.boroughGradRateMedian)*100);
    if (!Number.isNaN(delta) && delta !== 0) bits.push(`grad rate ${delta>0?"above":"below"} borough avg`);
  }
  const sentence = bits.length ? bits.join(", ") : "Balanced option with solid fit.";
  return `${p.schoolName}: ${sentence}.`;
}
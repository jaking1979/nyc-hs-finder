"use client";

import { useMemo, useState } from "react";
import type { SlotState, ScoredProgram, ProgramRow } from "../types/scoring";

const PRESETS = {
  Balanced: { ProgramFit:0.34, Commute:0.22, Supports:0.18, Outcomes:0.18, Environment:0.08 },
  ShortCommute: { ProgramFit:0.28, Commute:0.32, Supports:0.16, Outcomes:0.18, Environment:0.06 },
  IEP_Priority: { ProgramFit:0.28, Commute:0.18, Supports:0.32, Outcomes:0.16, Environment:0.06 },
  Outcomes_First: { ProgramFit:0.26, Commute:0.18, Supports:0.16, Outcomes:0.34, Environment:0.06 },
} as const;

type PresetKey = keyof typeof PRESETS;

const BOROUGHS = ["Brooklyn","Queens","Manhattan","Bronx","Staten Island"] as const;
const INTERESTS = ["STEM","Health","Humanities","PerformingArts","VisualArts","CTE-Tech"] as const;
const COMMUTE_OPTIONS = [20, 30, 45, 60, 75, 90] as const;
const SUPPORTS = ["IEP","ELL","Accessibility"] as const;
const ADMISSIONS_FILTERS = [
  { key: "allow_all", label: "Include all programs" },
  { key: "no_audition", label: "Exclude audition programs" },
  { key: "no_screened", label: "Exclude screened programs" }
] as const;
const LANGUAGES = ["Spanish","Mandarin","French","Arabic","Bengali","Russian","Korean","Urdu","Haitian Creole"] as const;
const ARTS = ["Visual portfolio","Instrumental music","Theater","Dance","Vocal music"] as const;

const EMPTY_SLOTS: SlotState = {
  boroughs: [],
  commuteCapMins: 60,
  admissionsOptOut: "allow_all",
  programInterests: [],
  mustHaves: { arts: [], sports: [], languages: [], apCourses: [] },
  supportNeeds: [],
  environmentPrefs: { singleSexOk: true, pedagogy: "Either" }
};

export default function AdvisorChat({ initialPrograms }: { initialPrograms?: ProgramRow[] }) {
  const [step, setStep] = useState<number>(0);
  const [slots, setSlots] = useState<SlotState>(EMPTY_SLOTS);
  const [preset, setPreset] = useState<PresetKey>("Balanced");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<(ScoredProgram & { admissionsMethod?: string; admissionsPriorities?: string[]; eligibilityText?: string; programCode?: string; tags?: string[]; dataAsOf?: string; })[] | null>(null);
  const [meta, setMeta] = useState<{ dataSource?: string; url?: string; programCount?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canScore = useMemo(() => {
    return (slots.boroughs?.length || 0) > 0 && (slots.programInterests?.length || 0) > 0;
  }, [slots]);

  async function runScoring() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/advise/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, weights: PRESETS[preset], programs: initialPrograms || undefined })
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || "Score error");
      setResults(json.results as any);
      setMeta(json.meta || null);
      setStep(4);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "40px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Advisor</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        Tell me about your child’s needs and interests. I’ll suggest programs and explain why each fits.
      </p>

      <nav style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {["Basics","Supports","Preferences","Weights","Results"].map((label,i)=>(
          <button
            key={label}
            onClick={()=> setStep(i)}
            style={{
              padding: "6px 10px",
              border: "1px solid #ddd",
              background: i===step ? "#eee" : "#fff",
              borderRadius: 6,
              cursor: "pointer"
            }}
          >
            {i+1}. {label}
          </button>
        ))}
      </nav>

      {step===0 && (
        <section style={{ display: "grid", gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Where do you prefer school to be?</div>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 6 }}>Pick one or more boroughs. This helps us estimate commute and prioritize nearby options.</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
              {BOROUGHS.map(b => (
                <label key={b} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                  <input
                    type="checkbox"
                    checked={slots.boroughs.includes(b as any)}
                    onChange={(e) => {
                      setSlots(s => ({
                        ...s,
                        boroughs: e.target.checked
                          ? [...new Set([...(s.boroughs||[]), b as any])]
                          : (s.boroughs||[]).filter(x => x !== (b as any))
                      }));
                    }}
                  />
                  {b}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>What topics light them up?</div>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 6 }}>Choose a few interests. We’ll match to programs DOE labels with these themes.</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
              {INTERESTS.map(t => (
                <label key={t} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                  <input
                    type="checkbox"
                    checked={(slots.programInterests||[]).includes(t as any)}
                    onChange={(e) => {
                      setSlots(s => ({
                        ...s,
                        programInterests: e.target.checked
                          ? [...new Set([...(s.programInterests||[]), t as any])]
                          : (s.programInterests||[]).filter(x => x !== (t as any))
                      }));
                    }}
                  />
                  {t.replace("-"," – ")}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>How long is an okay commute?</div>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 6 }}>Shorter commutes boost a program’s score. You can loosen this later.</div>
            <select
              value={slots.commuteCapMins}
              onChange={(e)=> setSlots(s=> ({...s, commuteCapMins: Number(e.target.value)}))}
              style={{ width: 220, padding: 6, borderRadius: 6, border: "1px solid #ddd" }}
            >
              {COMMUTE_OPTIONS.map(m => (
                <option key={m} value={m}>{m} minutes or less</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
              <input type="checkbox" checked={!!slots.diversityEligible} onChange={(e) => setSlots((s) => ({ ...s, diversityEligible: e.target.checked }))} />
              <span>
                <strong>DIA eligible?</strong> <span style={{ color:"#555" }}>(Diversity in Admissions priority—if you qualify, some programs may give you priority.)</span>
              </span>
            </label>
          </div>

          <div style={{ marginTop: 8 }}>
            <button onClick={()=> setStep(1)} style={{ padding: "8px 14px", borderRadius: 6 }}>Continue →</button>
          </div>
        </section>
      )}

      {step===1 && (
        <section style={{ display: "grid", gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600 }}>What supports are needed?</div>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 6 }}>We’ll favor programs that mention these supports in DOE data.</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
              {SUPPORTS.map(sup => (
                <label key={sup} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                  <input
                    type="checkbox"
                    checked={(slots.supportNeeds||[]).includes(sup as any)}
                    onChange={(e) => {
                      setSlots(s => ({
                        ...s,
                        supportNeeds: e.target.checked
                          ? [...new Set([...(s.supportNeeds||[]), sup as any])]
                          : (s.supportNeeds||[]).filter(x => x !== (sup as any))
                      }));
                    }}
                  />
                  {sup === "IEP" ? "IEP / Inclusion" : sup}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>Admissions types to include</div>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 6 }}>If auditions or screened programs aren’t a fit, we’ll filter them out.</div>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              {ADMISSIONS_FILTERS.map(opt => (
                <label key={opt.key} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                  <input
                    type="radio"
                    name="adopt"
                    checked={slots.admissionsOptOut === (opt.key as any)}
                    onChange={()=> setSlots(s=> ({...s, admissionsOptOut: opt.key as any}))}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <button onClick={()=> setStep(2)} style={{ padding: "8px 14px", borderRadius: 6 }}>Continue →</button>
          </div>
        </section>
      )}

      {step===2 && (
        <section style={{ display: "grid", gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600 }}>Classroom vibe</div>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 6 }}>Traditional = tests and lectures. Progressive = projects and collaboration. Pick what feels right (or choose Either).</div>
            <select
              value={slots.environmentPrefs?.pedagogy || "Either"}
              onChange={(e) => setSlots((s) => ({ ...s, environmentPrefs: { ...(s.environmentPrefs||{}), pedagogy: e.target.value as any } }))}
              style={{ width: 260, padding: 6, borderRadius: 6, border: "1px solid #ddd" }}
            >
              <option>Either</option>
              <option>Traditional</option>
              <option>Progressive</option>
            </select>
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>Must‑have languages (optional)</div>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 6 }}>Choose any that are important to your family. We’ll only boost programs that offer them.</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
              {LANGUAGES.map(lang => (
                <label key={lang} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                  <input
                    type="checkbox"
                    checked={(slots.mustHaves?.languages||[]).includes(lang)}
                    onChange={(e)=> setSlots(s=> ({
                      ...s,
                      mustHaves: {
                        ...s.mustHaves,
                        languages: e.target.checked
                          ? [...new Set([...(s.mustHaves?.languages||[]), lang])]
                          : (s.mustHaves?.languages||[]).filter(x => x !== lang)
                      }
                    }))}
                  />
                  {lang}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontWeight: 600 }}>Must‑have arts (optional)</div>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 6 }}>If your student needs a specific arts track, pick it here.</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
              {ARTS.map(a => (
                <label key={a} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                  <input
                    type="checkbox"
                    checked={(slots.mustHaves?.arts||[]).includes(a)}
                    onChange={(e)=> setSlots(s=> ({
                      ...s,
                      mustHaves: {
                        ...s.mustHaves,
                        arts: e.target.checked
                          ? [...new Set([...(s.mustHaves?.arts||[]), a])]
                          : (s.mustHaves?.arts||[]).filter(x => x !== a)
                      }
                    }))}
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <button onClick={()=> setStep(3)} style={{ padding: "8px 14px", borderRadius: 6 }}>Continue →</button>
          </div>
        </section>
      )}

      {step===3 && (
        <section style={{ display: "grid", gap: 12, marginBottom: 16 }}>
          <div>
            <strong>Weight preset:</strong>
            {Object.keys(PRESETS).map((k)=>(
              <button
                key={k}
                onClick={()=> setPreset(k as PresetKey)}
                style={{
                  marginLeft: 8, padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6,
                  background: preset===k ? "#eee" : "#fff", cursor: "pointer"
                }}
              >
                {k}
              </button>
            ))}
          </div>

          <div>
            <button
              disabled={!canScore || loading}
              onClick={runScoring}
              style={{ padding: "10px 16px", borderRadius: 8 }}
            >
              {loading ? "Scoring..." : "See Matches"}
            </button>
            {!canScore && <span style={{ marginLeft: 12, color: "#666" }}>Add boroughs and interests first</span>}
          </div>
        </section>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {results && step===4 && (
        <div style={{ marginTop: 24 }}>
          <h2>Top Matches</h2>
          {meta && (
            <div style={{ fontSize: 12, marginBottom: 12, color: "#555" }}>
              Source: <strong>{meta.dataSource || "unknown"}</strong>
              {typeof meta.programCount === "number" && <> · Programs loaded: <strong>{meta.programCount}</strong></>}
              {meta.url && (
                <> · <a href={meta.url} target="_blank" rel="noreferrer">view JSON</a></>
              )}
            </div>
          )}
          <ol>
            {results.map((r) => (
              <li key={r.programId} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #eee" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong>{r.name}</strong>
                  <span style={{ fontSize: 13, color: "#444" }}>Score {r.score}</span>
                </div>
                <div style={{ fontSize: 14, opacity: 0.85 }}>{r.schoolName}</div>
                <div style={{ fontSize: 13, marginTop: 6, color: "#444" }}>
                  {r.admissionsMethod && (
                    <span style={{ display:"inline-block", padding:"2px 8px", border:"1px solid #ddd", borderRadius:999, marginRight:8 }}>
                      {String(r.admissionsMethod)}
                    </span>
                  )}
                  {Array.isArray((r as any).admissionsPriorities) && (r as any).admissionsPriorities.length > 0 && (
                    <span style={{ color:"#555" }}>
                      Priority: {(r as any).admissionsPriorities[0]}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, marginTop: 6, opacity: 0.9 }}>{r.rationale}</div>
                <details style={{ marginTop: 6 }}>
                  <summary>Why this match?</summary>
                  <div style={{ fontSize: 13 }}>
                    <div>Program Fit: {r.pillars.ProgramFit}</div>
                    <div>Commute: {r.pillars.Commute}</div>
                    <div>Supports: {r.pillars.Supports}</div>
                    <div>Outcomes: {r.pillars.Outcomes}</div>
                    <div>Environment: {r.pillars.Environment}</div>
                    {r.pillars.penalties !== 0 && <div>Penalties: {r.pillars.penalties}</div>}
                  </div>
                </details>
                {(((r as any).eligibilityText) || ((r as any).admissionsPriorities && (r as any).admissionsPriorities.length)) && (
                  <details style={{ marginTop: 6 }}>
                    <summary>Eligibility & priorities</summary>
                    <div style={{ fontSize: 13, color:"#333" }}>
                      {(r as any).eligibilityText && (
                        <div style={{ marginBottom: 6 }}>
                          {(r as any).eligibilityText}
                        </div>
                      )}
                      {Array.isArray((r as any).admissionsPriorities) && (r as any).admissionsPriorities.length > 0 && (
                        <ul style={{ margin:"6px 0 0 18px" }}>
                          {(r as any).admissionsPriorities.map((p:string, idx:number)=>(
                            <li key={idx}>{p}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                )}
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>Data as of {r.dataAsOf}</div>
              </li>
            ))}
          </ol>

          <button onClick={()=> setStep(0)} style={{ marginTop: 8, padding: "8px 14px", borderRadius: 6 }}>
            Start over
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { SlotState, ScoredProgram, ProgramRow } from "../types/scoring";

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
  const [slots, setSlots] = useState<SlotState>(EMPTY_SLOTS);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScoredProgram[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runScoring() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/advise/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots, programs: initialPrograms || undefined })
      });
      const json = await resp.json();
      if (!json.ok) throw new Error(json.error || "Score error");
      setResults(json.results as ScoredProgram[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>Advisor (MVP)</h1>

      <section style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <label>
          Boroughs (comma‑sep):{" "}
          <input
            placeholder="Brooklyn, Queens"
            onChange={(e) =>
              setSlots((s) => ({
                ...s,
                boroughs: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean) as SlotState["boroughs"]
              }))
            }
          />
        </label>

        <label>
          Commute cap (mins):{" "}
          <input
            type="number"
            defaultValue={slots.commuteCapMins}
            onChange={(e) => setSlots((s) => ({ ...s, commuteCapMins: Number(e.target.value || 60) }))}
          />
        </label>

        <label>
          Program interests (comma‑sep):{" "}
          <input
            placeholder="STEM, Health, VisualArts"
            onChange={(e) =>
              setSlots((s) => ({
                ...s,
                programInterests: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean) as SlotState["programInterests"]
              }))
            }
          />
        </label>

        <label>
          Must‑have arts (comma‑sep):{" "}
          <input
            placeholder="orchestra, visual-portfolio"
            onChange={(e) =>
              setSlots((s) => ({
                ...s,
                mustHaves: { ...s.mustHaves, arts: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) }
              }))
            }
          />
        </label>

        <label>
          IEP inclusion required?{" "}
          <input
            type="checkbox"
            onChange={(e) => setSlots((s) => ({ ...s, iepInclusionRequired: e.target.checked }))}
          />
        </label>

        <label>
          Diversity in Admissions eligible?{" "}
          <input
            type="checkbox"
            onChange={(e) => setSlots((s) => ({ ...s, diversityEligible: e.target.checked }))}
          />
        </label>
      </section>

      <button disabled={loading} onClick={runScoring}>
        {loading ? "Scoring..." : "See Matches"}
      </button>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {results && (
        <div style={{ marginTop: 24 }}>
          <h2>Results</h2>
          <ol>
            {results.map((r) => (
              <li key={r.programId} style={{ marginBottom: 12 }}>
                <strong>{r.name}</strong> — {r.schoolName} (score {r.score})
                <div style={{ fontSize: 14, opacity: 0.8 }}>{r.rationale}</div>
                <details style={{ marginTop: 6 }}>
                  <summary>Why this match?</summary>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(r.pillars, null, 2)}</pre>
                </details>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Data as of {r.dataAsOf}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

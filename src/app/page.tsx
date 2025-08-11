"use client";
import * as React from "react";

type Weights = {
  academics: number; admissions: number; extracurricular: number;
  supports: number; commute: number; culture: number;
};

type School = {
  id: string; name: string; borough: string; neighborhood: string;
  admissions_method: "Safety"|"Target"|"Reach"|"High Reach";
  commute_minutes: number;
  academics_rigor: number; // 1–5
  culture: number;         // 1–5
  supports: number;        // 1–5
  tags: string[];          // for interests match
};

const MOCK: School[] = [
  { id:"goldstein", name:"Leon M. Goldstein HS for the Sciences", borough:"Brooklyn", neighborhood:"Manhattan Beach", admissions_method:"Target", commute_minutes:38, academics_rigor:4.4, culture:3.9, supports:3.8, tags:["science","robotics","ap"] },
  { id:"midwood",   name:"Midwood HS (Medical Science & Physics/Math)", borough:"Brooklyn", neighborhood:"Midwood", admissions_method:"Target", commute_minutes:33, academics_rigor:4.6, culture:3.6, supports:3.5, tags:["medical","physics","ap"] },
  { id:"fortham",   name:"Fort Hamilton HS (Honors Academy)", borough:"Brooklyn", neighborhood:"Bay Ridge", admissions_method:"Target", commute_minutes:12, academics_rigor:4.0, culture:3.7, supports:3.6, tags:["ap","sports"] },
];

function chipStyle(mins: number, cap: number) {
  if (mins <= cap) return { background:"#dcfce7", color:"#166534" } as React.CSSProperties;
  if (mins <= cap + 7) return { background:"#fef9c3", color:"#854d0e" } as React.CSSProperties;
  return { background:"#fee2e2", color:"#991b1b" } as React.CSSProperties;
}

export default function HomePage() {
  // Steps
  const [step, setStep] = React.useState<1|2|3|4>(1);

  // Step 1 — location & commute
  const [location, setLocation] = React.useState("");
  const [commuteCap, setCommuteCap] = React.useState(45);

  // Step 2 — weights
  const [weights, setWeights] = React.useState<Weights>({
    academics: 30, admissions: 20, extracurricular: 20, supports: 10, commute: 10, culture: 10,
  });

  // Step 3 — interests
  const [interests, setInterests] = React.useState("robotics, soccer, coding");

  // Live commute (uses stubbed /api/commute)
  const [liveSchools, setLiveSchools] = React.useState<School[]>(MOCK);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(()=>{
    let active = true;
    if (!location || location.trim().length < 3) { setLiveSchools(MOCK); return; }
    (async ()=>{
      setBusy(true);
      try {
        const updated = await Promise.all(MOCK.map(async s => {
          const r = await fetch(`/api/commute?from=${encodeURIComponent(location)}&to=${encodeURIComponent(s.id)}`);
          const d = r.ok ? await r.json() : { minutes: s.commute_minutes };
          const mins = Math.max(5, Math.min(120, Math.round(d.minutes || s.commute_minutes)));
          return { ...s, commute_minutes: mins } as School;
        }));
        if (active) setLiveSchools(updated);
      } finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [location]);

  // Scorer using the weights
  const results = React.useMemo(() => {
    const tokens = interests.toLowerCase().split(",").map(s=>s.trim()).filter(Boolean);
    return liveSchools.map((s) => {
      const interestMatch = tokens.some(t => s.tags.some(tag => tag.includes(t)));
      const interestScore = interestMatch ? 1 : 0; // simple bump for match
      const commuteScore = Math.max(0, 1 - Math.max(0, s.commute_minutes - commuteCap) / 60);
      const score =
        (s.academics_rigor/5) * (weights.academics/100) +
        (s.culture/5)         * (weights.culture/100) +
        (s.supports/5)        * (weights.supports/100) +
        (commuteScore)        * (weights.commute/100) +
        (interestScore)       * (weights.extracurricular/100);
      return { school: s, score: Number(score.toFixed(3)) };
    }).sort((a,b)=> b.score - a.score);
  }, [weights, commuteCap, interests, liveSchools]);

  async function downloadPDF() {
    const payload = {
      profile: { weights, summary: `Location: ${location || 'N/A'} • Interests: ${interests}` },
      results: results.map(r => ({ school: r.school })),
      hiddenGems: [],
      commuteCap: commuteCap,
    };
    const res = await fetch('/api/pdf', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) { alert('PDF failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'nyc-hs-guide.pdf'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ padding: "24px", maxWidth: 960, margin: "0 auto", fontFamily: "system-ui, -apple-system" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>NYC HS Finder</h1>
      <p style={{ color: "#475569", marginBottom: 18 }}>
        Let’s personalize your list. Three quick steps → then we’ll show matches.
      </p>

      {/* Step tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:18 }}>
        {["Location", "Priorities", "Interests", "Preview"].map((label, i) => {
          const n = (i+1) as 1|2|3|4;
          const active = step === n;
          return (
            <button key={label}
              onClick={()=>setStep(n)}
              style={{
                padding:"6px 10px", borderRadius:8,
                border: active ? "2px solid #1d4ed8" : "1px solid #e2e8f0",
                background: active ? "#eff6ff" : "#fff", color:"#0f172a", fontWeight:600, cursor:"pointer"
              }}
            >
              {n}. {label}
            </button>
          );
        })}
      </div>

      {step === 1 && (
        <section style={{ display:"grid", gap:14 }}>
          <label style={{ display:"grid", gap:6 }}>
            <span style={{ fontWeight:600 }}>Your location (ZIP or address)</span>
            <input
              value={location}
              onChange={(e)=>setLocation(e.target.value)}
              placeholder="e.g., 11209 or 4th Ave & 86th St"
              style={{ padding:"8px 10px", border:"1px solid #cbd5e1", borderRadius:8, maxWidth: 420 }}
            />
          </label>

          <label style={{ display:"grid", gap:6 }}>
            <span style={{ fontWeight:600 }}>Commute cap (minutes) <span style={{ color:"#64748b"}}>(+7 min buffer)</span></span>
            <input
              type="number"
              value={commuteCap}
              onChange={(e)=>setCommuteCap(parseInt(e.target.value || "45", 10))}
              style={{ padding:"8px 10px", border:"1px solid #cbd5e1", borderRadius:8, width: 120 }}
            />
          </label>

          {busy && (
            <div style={{ fontSize: 12, color: '#64748b' }}>Updating commute times…</div>
          )}

          <div>
            <button onClick={()=>setStep(2)}
              style={{ background:"#1d4ed8", color:"#fff", border:"1px solid #1d4ed8", padding:"8px 12px", borderRadius:8, cursor:"pointer" }}>
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section style={{ display:"grid", gap:16 }}>
          <p style={{ color:"#475569" }}>Tell us what matters most. These sliders set your weights (total doesn’t need to be 100%).</p>
          {([
            ["Academics Rigor","academics"],
            ["Admissions Selectivity","admissions"],
            ["Extracurriculars / Interests","extracurricular"],
            ["Student Supports","supports"],
            ["Commute Convenience","commute"],
            ["School Culture","culture"],
          ] as const).map(([label, key]) => (
            <div key={key}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontWeight:600 }}>{label}</span>
                <span style={{ color:"#334155"}}>{weights[key]}%</span>
              </div>
              <input
                type="range" min={0} max={50} step={5}
                value={weights[key]}
                onChange={(e)=>setWeights(w => ({ ...w, [key]: parseInt(e.target.value, 10) }))}
                style={{ width:"100%" }}
              />
            </div>
          ))}
          <div>
            <button onClick={()=>setStep(3)}
              style={{ background:"#1d4ed8", color:"#fff", border:"1px solid #1d4ed8", padding:"8px 12px", borderRadius:8, cursor:"pointer" }}>
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section style={{ display:"grid", gap:14 }}>
          <label style={{ display:"grid", gap:6 }}>
            <span style={{ fontWeight:600 }}>Student interests (comma separated)</span>
            <input
              value={interests}
              onChange={(e)=>setInterests(e.target.value)}
              placeholder="e.g., robotics, debate, art"
              style={{ padding:"8px 10px", border:"1px solid #cbd5e1", borderRadius:8, maxWidth: 520 }}
            />
          </label>

          <div>
            <button onClick={()=>setStep(4)}
              style={{ background:"#1d4ed8", color:"#fff", border:"1px solid #1d4ed8", padding:"8px 12px", borderRadius:8, cursor:"pointer" }}>
              See my matches
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section style={{ display:"grid", gap:12 }}>
          <div style={{ color:"#475569" }}>
            Showing sample matches using your weights, commute cap ({commuteCap}m + 7 buffer), and interests.
          </div>

          {results.map(({ school: s, score }, i) => (
            <div key={s.id} style={{ border:"1px solid #e2e8f0", borderRadius:12, padding:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", gap:12 }}>
                <div>
                  <div style={{ fontWeight:700 }}>{i+1}. {s.name}</div>
                  <div style={{ color:"#475569" }}>{s.borough} • {s.neighborhood} • {s.admissions_method}</div>
                  <div style={{ marginTop:6, color:"#334155", fontSize:13 }}>
                    Score: <b>{score}</b> • Academics {s.academics_rigor.toFixed(1)}/5 • Culture {s.culture.toFixed(1)}/5 • Supports {s.supports.toFixed(1)}/5
                  </div>
                </div>
                <span style={{ border:"1px solid #e2e8f0", borderRadius:6, padding:"4px 8px", fontSize:12, fontWeight:700, ...chipStyle(s.commute_minutes, commuteCap) }}>
                  {s.commute_minutes} min{s.commute_minutes>commuteCap?` • ${s.commute_minutes-commuteCap} over cap`:''}
                </span>
              </div>
            </div>
          ))}

          <div style={{ marginTop:8, display:"flex", gap:10 }}>
            <button onClick={()=>setStep(1)} style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #cbd5e1", background:"#fff", cursor:"pointer" }}>
              Back
            </button>
            <button onClick={downloadPDF} style={{ padding:"8px 12px", borderRadius:8, background:"#1d4ed8", border:"1px solid #1d4ed8", color:"#fff", cursor:"pointer" }}>
              Download PDF
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
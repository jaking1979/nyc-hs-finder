import React from "react";
export default function Tag({children}:{children:React.ReactNode}) {
  return <span style={{
    display:"inline-block", padding:"2px 8px", fontSize:"var(--fs-12)", color:"var(--brand-ink)",
    background:"color-mix(in oklab, var(--brand) 14%, transparent)", borderRadius:"999px", border:"1px solid var(--border)"
  }}>{children}</span>;
}

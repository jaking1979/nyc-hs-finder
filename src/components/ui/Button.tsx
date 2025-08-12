import React from "react";
export default function Button({children, variant="primary", ...rest}:{children:React.ReactNode; variant?: "primary"|"ghost"} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base: React.CSSProperties = {
    fontFamily:"var(--font-sans)", fontSize:"var(--fs-14)", lineHeight:"var(--lh-tight)",
    padding:"8px 14px", borderRadius:"var(--radius-6)", cursor:"pointer", border:"1px solid var(--border)", background:"transparent"
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background:"var(--brand)", color:"white", borderColor:"var(--brand)", },
    ghost: { background:"transparent", color:"var(--text)" }
  };
  return <button style={{...base, ...variants[variant]}} {...rest}>{children}</button>;
}

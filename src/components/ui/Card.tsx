import React from "react";
export default function Card({children, as:As="div", style, ...rest}:{children:React.ReactNode; as?:any; style?:React.CSSProperties}) {
  return <As style={{
    background:"var(--card-bg)", border:"1px solid var(--border)", borderRadius:"var(--radius-10)",
    padding:"var(--sp-16)", boxShadow:"var(--card-shadow)", ...style
  }} {...rest}>{children}</As>;
}

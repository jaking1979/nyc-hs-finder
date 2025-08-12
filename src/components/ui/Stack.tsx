import React from "react";
export default function Stack({gap=12, children, ...rest}:{gap?:number; children:React.ReactNode} & React.HTMLAttributes<HTMLDivElement>) {
  return <div style={{display:"grid", gap, ...rest}}>{children}</div>;
}

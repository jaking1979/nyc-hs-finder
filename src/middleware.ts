import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // Redirect only the root path "/" to "/advisor"
  if (req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/advisor";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Only run on the root path
export const config = { matcher: ["/"] };

import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/welcome", "/login", "/register", "/offline"];

/** Cheap edge check: redirect to /welcome when there is no session cookie. Full validation happens server-side. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.cookies.get("efl_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|icons|sw.js|manifest.webmanifest|favicon.ico).*)"],
};

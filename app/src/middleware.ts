import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PROTECTED = ["/dashboard", "/transactions", "/categories", "/ledgers", "/settings"];

export default auth((req) => {
  const isProtected = PROTECTED.some((p) =>
    req.nextUrl.pathname.startsWith(p)
  );
  if (isProtected && !req.auth) {
    const url = new URL("/login", req.nextUrl);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { HSTS, contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(securityHeaders())) {
    if (name === "Content-Security-Policy") continue;
    response.headers.set(name, value);
  }
  response.headers.set("Content-Security-Policy", csp);
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", HSTS);
  }
  response.headers.delete("x-powered-by");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { HSTS, SECURITY_HEADERS } from "@/lib/security-headers";

export function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", HSTS);
  }
  response.headers.delete("x-powered-by");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

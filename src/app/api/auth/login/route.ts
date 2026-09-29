import { authenticate, sessionCookie } from "@/lib/auth/credentials";
import { secureCookies } from "@/lib/auth/session";
import { ApiError } from "@/server/errors";
import { clientIp, json, readJson, route } from "@/server/http";
import { loginSchema, parseBody } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  const input = parseBody(loginSchema, await readJson(request));
  const result = await authenticate(input.email, input.motDePasse, clientIp(request), secureCookies(request));
  if (result.status === "invalid") {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Identifiants invalides.");
  }
  if (result.status === "disabled") {
    throw new ApiError(403, "ACCOUNT_DISABLED", "Compte désactivé.");
  }
  return json({ utilisateur: result.utilisateur }, 200, {
    "Set-Cookie": sessionCookie(result.token, request),
  });
});

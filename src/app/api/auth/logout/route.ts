import { clearedCookie, revokeSession } from "@/lib/auth/credentials";
import { requireSession } from "@/lib/auth/session";
import { clientIp, json, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request) => {
  const session = await requireSession(request);
  await revokeSession(session.id, clientIp(request));
  return json({ ok: true }, 200, { "Set-Cookie": clearedCookie(request) });
});

import { requireSession } from "@/lib/auth/session";
import { json, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const session = await requireSession(request);
  return json({ utilisateur: session });
});

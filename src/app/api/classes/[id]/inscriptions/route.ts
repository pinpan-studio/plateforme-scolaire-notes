import { requireSession } from "@/lib/auth/session";
import { assignEleve } from "@/server/classes";
import { json, readJson, route } from "@/server/http";
import { parseRouteId } from "@/server/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request, { params }) => {
  const session = await requireSession(request);
  return json(await assignEleve(session, parseRouteId(params), await readJson(request)), 201);
});

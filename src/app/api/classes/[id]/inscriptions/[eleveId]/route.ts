import { requireSession } from "@/lib/auth/session";
import { removeInscription } from "@/server/classes";
import { empty, route } from "@/server/http";
import { parseRouteId } from "@/server/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = route(async (request, { params }) => {
  await removeInscription(await requireSession(request), parseRouteId(params), parseRouteId(params, "eleveId"));
  return empty();
});

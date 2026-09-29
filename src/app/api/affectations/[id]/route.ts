import { requireSession } from "@/lib/auth/session";
import { empty, route } from "@/server/http";
import { parseRouteId } from "@/server/query";
import { deleteAffectation } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = route(async (request, { params }) => {
  await deleteAffectation(await requireSession(request), parseRouteId(params));
  return empty();
});

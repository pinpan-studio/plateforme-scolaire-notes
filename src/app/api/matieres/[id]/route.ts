import { requireSession } from "@/lib/auth/session";
import { empty, json, readJson, route } from "@/server/http";
import { parseRouteId } from "@/server/query";
import { deleteMatiere, updateMatiere } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = route(async (request, { params }) =>
  json(await updateMatiere(await requireSession(request), parseRouteId(params), await readJson(request))),
);

export const DELETE = route(async (request, { params }) => {
  await deleteMatiere(await requireSession(request), parseRouteId(params));
  return empty();
});

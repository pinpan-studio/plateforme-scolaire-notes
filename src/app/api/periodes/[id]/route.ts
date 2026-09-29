import { requireSession } from "@/lib/auth/session";
import { empty, json, readJson, route } from "@/server/http";
import { parseRouteId } from "@/server/query";
import { deletePeriode, updatePeriode } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = route(async (request, { params }) =>
  json(await updatePeriode(await requireSession(request), parseRouteId(params), await readJson(request))),
);

export const DELETE = route(async (request, { params }) => {
  await deletePeriode(await requireSession(request), parseRouteId(params));
  return empty();
});

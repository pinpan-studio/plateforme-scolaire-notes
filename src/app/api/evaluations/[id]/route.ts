import { requireSession } from "@/lib/auth/session";
import { deleteEvaluation, getEvaluation, updateEvaluation } from "@/server/evaluations";
import { empty, json, readJson, route } from "@/server/http";
import { parseRouteId } from "@/server/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request, { params }) =>
  json(await getEvaluation(await requireSession(request), parseRouteId(params))),
);

export const PATCH = route(async (request, { params }) =>
  json(await updateEvaluation(await requireSession(request), parseRouteId(params), await readJson(request))),
);

export const DELETE = route(async (request, { params }) => {
  await deleteEvaluation(await requireSession(request), parseRouteId(params));
  return empty();
});

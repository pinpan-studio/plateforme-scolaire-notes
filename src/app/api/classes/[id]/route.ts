import { requireSession } from "@/lib/auth/session";
import { deleteClasse, getClasse, updateClasse } from "@/server/classes";
import { empty, json, readJson, route } from "@/server/http";
import { parseRouteId } from "@/server/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request, { params }) => json(await getClasse(await requireSession(request), parseRouteId(params))));

export const PATCH = route(async (request, { params }) =>
  json(await updateClasse(await requireSession(request), parseRouteId(params), await readJson(request))),
);

export const DELETE = route(async (request, { params }) => {
  await deleteClasse(await requireSession(request), parseRouteId(params));
  return empty();
});

import { requireSession } from "@/lib/auth/session";
import { deleteEleve, getEleve, updateEleve } from "@/server/eleves";
import { empty, json, readJson, route } from "@/server/http";
import { parseRouteId } from "@/server/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request, { params }) => {
  const session = await requireSession(request);
  return json(await getEleve(session, parseRouteId(params)));
});

export const PATCH = route(async (request, { params }) => {
  const session = await requireSession(request);
  return json(await updateEleve(session, parseRouteId(params), await readJson(request)));
});

export const DELETE = route(async (request, { params }) => {
  const session = await requireSession(request);
  await deleteEleve(session, parseRouteId(params));
  return empty();
});

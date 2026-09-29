import { requireSession } from "@/lib/auth/session";
import { empty, json, readJson, route } from "@/server/http";
import { deleteNote, getNote, updateNote } from "@/server/notes";
import { parseRouteId } from "@/server/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request, { params }) =>
  json(await getNote(await requireSession(request), parseRouteId(params))),
);

export const PATCH = route(async (request, { params }) =>
  json(await updateNote(await requireSession(request), parseRouteId(params), await readJson(request))),
);

export const DELETE = route(async (request, { params }) => {
  await deleteNote(await requireSession(request), parseRouteId(params));
  return empty();
});

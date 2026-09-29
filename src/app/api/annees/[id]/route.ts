import { requireSession } from "@/lib/auth/session";
import { json, readJson, route } from "@/server/http";
import { parseRouteId } from "@/server/query";
import { updateAnnee } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = route(async (request, { params }) =>
  json(await updateAnnee(await requireSession(request), parseRouteId(params), await readJson(request))),
);

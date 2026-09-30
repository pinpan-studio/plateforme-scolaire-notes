import { requireSession } from "@/lib/auth/session";
import { clientIp, json, readJson, route } from "@/server/http";
import { parseRouteId } from "@/server/query";
import { updateUtilisateur } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = route(async (request, { params }) =>
  json(
    await updateUtilisateur(
      await requireSession(request),
      parseRouteId(params),
      await readJson(request),
      clientIp(request),
    ),
  ),
);

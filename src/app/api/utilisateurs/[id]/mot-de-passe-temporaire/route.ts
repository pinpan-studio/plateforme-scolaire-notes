import { requireSession } from "@/lib/auth/session";
import { json, route } from "@/server/http";
import { parseRouteId } from "@/server/query";
import { definirMotDePasseTemporaire } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request, { params }) =>
  json(await definirMotDePasseTemporaire(await requireSession(request), parseRouteId(params))),
);

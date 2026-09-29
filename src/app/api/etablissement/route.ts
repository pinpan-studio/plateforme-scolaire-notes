import { requireSession } from "@/lib/auth/session";
import { json, readJson, route } from "@/server/http";
import { getEtablissement, updateEtablissement } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await getEtablissement(await requireSession(request))));

export const PATCH = route(async (request) =>
  json(await updateEtablissement(await requireSession(request), await readJson(request))),
);

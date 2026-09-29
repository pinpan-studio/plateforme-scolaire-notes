import { requireSession } from "@/lib/auth/session";
import { json, readJson, route } from "@/server/http";
import { createEnseignant, listEnseignants } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await listEnseignants(await requireSession(request), request)));

export const POST = route(async (request) =>
  json(await createEnseignant(await requireSession(request), await readJson(request)), 201),
);

import { requireSession } from "@/lib/auth/session";
import { json, readJson, route } from "@/server/http";
import { createAffectation, listAffectations } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await listAffectations(await requireSession(request), request)));

export const POST = route(async (request) =>
  json(await createAffectation(await requireSession(request), await readJson(request)), 201),
);

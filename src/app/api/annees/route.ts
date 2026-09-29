import { requireSession } from "@/lib/auth/session";
import { json, readJson, route } from "@/server/http";
import { createAnnee, listAnnees } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await listAnnees(await requireSession(request))));

export const POST = route(async (request) =>
  json(await createAnnee(await requireSession(request), await readJson(request)), 201),
);

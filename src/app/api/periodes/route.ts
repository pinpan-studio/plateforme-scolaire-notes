import { requireSession } from "@/lib/auth/session";
import { json, readJson, route } from "@/server/http";
import { createPeriode, listPeriodes } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await listPeriodes(await requireSession(request), request)));

export const POST = route(async (request) =>
  json(await createPeriode(await requireSession(request), await readJson(request)), 201),
);

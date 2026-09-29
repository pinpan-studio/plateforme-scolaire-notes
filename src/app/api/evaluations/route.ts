import { requireSession } from "@/lib/auth/session";
import { createEvaluation, listEvaluations } from "@/server/evaluations";
import { json, readJson, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await listEvaluations(await requireSession(request), request)));

export const POST = route(async (request) =>
  json(await createEvaluation(await requireSession(request), await readJson(request)), 201),
);

import { requireSession } from "@/lib/auth/session";
import { json, route } from "@/server/http";
import { listNiveaux } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await listNiveaux(await requireSession(request))));

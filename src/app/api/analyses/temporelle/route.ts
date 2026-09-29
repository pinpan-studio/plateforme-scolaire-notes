import { requireSession } from "@/lib/auth/session";
import { json, route } from "@/server/http";
import { analyseTemporelle } from "@/server/resultats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await analyseTemporelle(await requireSession(request), request)));

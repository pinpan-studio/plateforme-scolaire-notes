import { requireSession } from "@/lib/auth/session";
import { json, route } from "@/server/http";
import { analyseMatiere } from "@/server/resultats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await analyseMatiere(await requireSession(request), request)));

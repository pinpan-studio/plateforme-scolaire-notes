import { requireSession } from "@/lib/auth/session";
import { enregistrerAppreciation, listerAppreciations } from "@/server/appreciations";
import { json, readJson, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await listerAppreciations(await requireSession(request), request)));

export const PUT = route(async (request) =>
  json(await enregistrerAppreciation(await requireSession(request), await readJson(request))),
);

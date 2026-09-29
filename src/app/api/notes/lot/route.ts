import { requireSession } from "@/lib/auth/session";
import { json, readJson, route } from "@/server/http";
import { saveLot } from "@/server/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request) =>
  json(await saveLot(await requireSession(request), await readJson(request)), 201),
);

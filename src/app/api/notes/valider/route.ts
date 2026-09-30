import { requireSession } from "@/lib/auth/session";
import { clientIp, json, readJson, route } from "@/server/http";
import { validateNotes } from "@/server/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request) =>
  json(await validateNotes(await requireSession(request), await readJson(request), clientIp(request))),
);

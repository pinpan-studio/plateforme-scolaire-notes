import { requireSession } from "@/lib/auth/session";
import { clientIp, json, readJson, route } from "@/server/http";
import { changerMotDePasse } from "@/server/referentiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = route(async (request) => {
  await changerMotDePasse(await requireSession(request), await readJson(request), clientIp(request));
  return json({ ok: true });
});

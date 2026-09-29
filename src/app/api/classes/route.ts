import { requireSession } from "@/lib/auth/session";
import { createClasse, listClasses } from "@/server/classes";
import { json, readJson, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await listClasses(await requireSession(request), request)));

export const POST = route(async (request) => {
  const session = await requireSession(request);
  return json(await createClasse(session, await readJson(request)), 201);
});

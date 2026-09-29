import { requireSession } from "@/lib/auth/session";
import { createEleve, listEleves } from "@/server/eleves";
import { json, readJson, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const session = await requireSession(request);
  return json(await listEleves(session, request));
});

export const POST = route(async (request) => {
  const session = await requireSession(request);
  return json(await createEleve(session, await readJson(request)), 201);
});

import { requireSession } from "@/lib/auth/session";
import { json, readJson, route } from "@/server/http";
import { createNote, listNotes } from "@/server/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (request) => json(await listNotes(await requireSession(request), request)));

export const POST = route(async (request) =>
  json(await createNote(await requireSession(request), await readJson(request)), 201),
);

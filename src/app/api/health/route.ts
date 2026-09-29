import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { json, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  try {
    await getDb().execute(sql`select 1`);
    return json({ status: "ok", database: "ok" });
  } catch {
    return json({ status: "error", database: "indisponible" }, 503);
  }
});

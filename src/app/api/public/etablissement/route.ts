import { etablissement } from "@/db/schema";
import { getDb } from "@/server/db";
import { json, route } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nom public, sans adresse ni contact, pour l'écran de connexion. */
export const GET = route(async () => {
  const [row] = await getDb().select({ nom: etablissement.nom }).from(etablissement).limit(1);
  return json({ nom: row?.nom ?? "Cahier de notes" });
});

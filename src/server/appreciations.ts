import { and, eq } from "drizzle-orm";
import { appreciationGenerale, classe, inscription, periode } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/permissions";
import { getDb } from "./db";
import { forbidden, notFound } from "./errors";
import { optionalUuid, searchParams } from "./query";
import { appreciationGeneraleSchema, parseBody } from "./schemas";
import { canReadClass, loadScope } from "./scope";

async function classeDeEleve(eleveId: string, anneeScolaireId: string) {
  const [link] = await getDb()
    .select({ classeId: inscription.classeId, professeurPrincipalId: classe.professeurPrincipalId })
    .from(inscription)
    .innerJoin(classe, eq(inscription.classeId, classe.id))
    .where(and(eq(inscription.eleveId, eleveId), eq(inscription.anneeScolaireId, anneeScolaireId)))
    .limit(1);
  return link ?? null;
}

function peutRediger(session: SessionUser, professeurPrincipalId: string | null) {
  if (session.role === "ADMIN") return true;
  return Boolean(session.enseignantId && professeurPrincipalId === session.enseignantId);
}

export async function enregistrerAppreciation(session: SessionUser, body: unknown) {
  const input = parseBody(appreciationGeneraleSchema, body);
  const db = getDb();
  const [periodeRow] = await db.select().from(periode).where(eq(periode.id, input.periodeId)).limit(1);
  if (!periodeRow) throw notFound("Période introuvable.");
  const link = await classeDeEleve(input.eleveId, periodeRow.anneeScolaireId);
  if (!link) throw notFound("Élève introuvable pour cette période.");
  if (!peutRediger(session, link.professeurPrincipalId)) {
    throw forbidden("Seul l'administrateur ou le professeur principal de la classe peut rédiger l'appréciation.");
  }
  const [existing] = await db
    .select()
    .from(appreciationGenerale)
    .where(and(eq(appreciationGenerale.eleveId, input.eleveId), eq(appreciationGenerale.periodeId, input.periodeId)))
    .limit(1);
  if (existing) {
    const [row] = await db
      .update(appreciationGenerale)
      .set({ texte: input.texte, auteurId: session.id })
      .where(eq(appreciationGenerale.id, existing.id))
      .returning();
    return { texte: row.texte };
  }
  const [row] = await db
    .insert(appreciationGenerale)
    .values({
      eleveId: input.eleveId,
      periodeId: input.periodeId,
      texte: input.texte,
      auteurId: session.id,
    })
    .returning();
  return { texte: row.texte };
}

export async function listerAppreciations(session: SessionUser, request: Request) {
  const params = searchParams(request);
  const classeId = optionalUuid(params, "classeId");
  const periodeId = optionalUuid(params, "periodeId");
  const eleveId = optionalUuid(params, "eleveId");
  const scope = await loadScope(session);
  if (classeId && !canReadClass(scope, classeId)) {
    throw forbidden("Cette classe est hors de votre périmètre.");
  }
  const db = getDb();
  const filters = [];
  if (periodeId) filters.push(eq(appreciationGenerale.periodeId, periodeId));
  if (eleveId) filters.push(eq(appreciationGenerale.eleveId, eleveId));
  if (classeId) {
    const eleves = await db
      .select({ eleveId: inscription.eleveId })
      .from(inscription)
      .where(eq(inscription.classeId, classeId));
    const ids = eleves.map((row) => row.eleveId);
    if (ids.length === 0) return { appreciations: [] };
    const rows = await db
      .select()
      .from(appreciationGenerale)
      .where(filters.length > 0 ? and(...filters) : undefined);
    return {
      appreciations: rows
        .filter((row) => ids.includes(row.eleveId))
        .map((row) => ({ eleveId: row.eleveId, periodeId: row.periodeId, texte: row.texte })),
    };
  }
  if (eleveId) {
    const [anyLink] = await db.select({ classeId: inscription.classeId }).from(inscription).where(eq(inscription.eleveId, eleveId)).limit(1);
    if (!anyLink || !canReadClass(scope, anyLink.classeId)) {
      throw forbidden("Cet élève est hors de votre périmètre.");
    }
  } else if (!canReadClass(scope, classeId ?? "")) {
    throw forbidden("Classe ou élève requis.");
  }
  const where = filters.length > 0 ? and(...filters) : undefined;
  const rows = await db.select().from(appreciationGenerale).where(where);
  return {
    appreciations: rows.map((row) => ({ eleveId: row.eleveId, periodeId: row.periodeId, texte: row.texte })),
  };
}

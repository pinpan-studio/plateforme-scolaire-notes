import { and, asc, count, eq, inArray } from "drizzle-orm";
import { affectationEnseignant, anneeScolaire, classe, eleve, evaluation, inscription, niveau, note } from "@/db/schema";
import { canWriteReferential, canWriteStudents, type SessionUser } from "@/lib/auth/permissions";
import { getDb } from "./db";
import { ApiError, forbidden, notFound } from "./errors";
import { optionalUuid, pagination, searchParams, versionOf } from "./query";
import { createClasseSchema, inscriptionSchema, parseBody, patchClasseSchema } from "./schemas";
import { canReadClass, classIdsInScope, loadScope } from "./scope";

function publicClasse(
  row: typeof classe.$inferSelect,
  extra: { niveauCode?: string; anneeLibelle?: string; effectif?: number },
) {
  return {
    id: row.id,
    nom: row.nom,
    niveauId: row.niveauId,
    niveauCode: extra.niveauCode ?? null,
    anneeScolaireId: row.anneeScolaireId,
    anneeLibelle: extra.anneeLibelle ?? null,
    professeurPrincipalId: row.professeurPrincipalId,
    effectif: extra.effectif ?? 0,
    version: versionOf(row.updatedAt),
  };
}

export async function listClasses(session: SessionUser, request: Request) {
  const params = searchParams(request);
  const page = pagination(params);
  const anneeScolaireId = optionalUuid(params, "anneeScolaireId");
  const scope = await loadScope(session);
  const allowed = classIdsInScope(scope);
  if (allowed && allowed.length === 0) {
    return { data: [], page: page.page, pageSize: page.pageSize, total: 0 };
  }
  return listClassesFiltered(page, anneeScolaireId, allowed);
}

async function listClassesFiltered(
  page: { page: number; pageSize: number; offset: number },
  anneeScolaireId: string | undefined,
  allowed: string[] | null,
) {
  const db = getDb();
  const filters = [];
  if (anneeScolaireId) filters.push(eq(classe.anneeScolaireId, anneeScolaireId));
  if (allowed) filters.push(inArray(classe.id, allowed));
  const where = filters.length > 0 ? and(...filters) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(classe).where(where);
  const rows = await db
    .select({
      classe,
      niveauCode: niveau.code,
      anneeLibelle: anneeScolaire.libelle,
    })
    .from(classe)
    .innerJoin(niveau, eq(classe.niveauId, niveau.id))
    .innerJoin(anneeScolaire, eq(classe.anneeScolaireId, anneeScolaire.id))
    .where(where)
    .orderBy(asc(classe.nom))
    .limit(page.pageSize)
    .offset(page.offset);

  const data = [];
  for (const row of rows) {
    const [{ effectif }] = await db
      .select({ effectif: count() })
      .from(inscription)
      .where(and(eq(inscription.classeId, row.classe.id), eq(inscription.statut, "INSCRIT")));
    data.push(publicClasse(row.classe, { niveauCode: row.niveauCode, anneeLibelle: row.anneeLibelle, effectif }));
  }
  return { data, page: page.page, pageSize: page.pageSize, total };
}

export async function getClasse(session: SessionUser, id: string) {
  const scope = await loadScope(session);
  if (!canReadClass(scope, id)) throw forbidden("Cette classe est hors de votre périmètre.");
  const db = getDb();
  const [row] = await db
    .select({ classe, niveauCode: niveau.code, anneeLibelle: anneeScolaire.libelle })
    .from(classe)
    .innerJoin(niveau, eq(classe.niveauId, niveau.id))
    .innerJoin(anneeScolaire, eq(classe.anneeScolaireId, anneeScolaire.id))
    .where(eq(classe.id, id))
    .limit(1);
  if (!row) throw notFound("Classe introuvable.");
  const [{ effectif }] = await db
    .select({ effectif: count() })
    .from(inscription)
    .where(and(eq(inscription.classeId, id), eq(inscription.statut, "INSCRIT")));
  return publicClasse(row.classe, { niveauCode: row.niveauCode, anneeLibelle: row.anneeLibelle, effectif });
}

export async function createClasse(session: SessionUser, body: unknown) {
  if (!canWriteReferential(session.role)) throw forbidden();
  const input = parseBody(createClasseSchema, body);
  const [row] = await getDb()
    .insert(classe)
    .values({
      nom: input.nom,
      niveauId: input.niveauId,
      anneeScolaireId: input.anneeScolaireId,
      professeurPrincipalId: input.professeurPrincipalId ?? null,
    })
    .returning();
  return publicClasse(row, {});
}

export async function updateClasse(session: SessionUser, id: string, body: unknown) {
  if (!canWriteReferential(session.role)) throw forbidden();
  const input = parseBody(patchClasseSchema, body);
  const db = getDb();
  const [current] = await db.select().from(classe).where(eq(classe.id, id)).limit(1);
  if (!current) throw notFound("Classe introuvable.");
  const [row] = await db
    .update(classe)
    .set({
      nom: input.nom ?? current.nom,
      niveauId: input.niveauId ?? current.niveauId,
      professeurPrincipalId:
        input.professeurPrincipalId === undefined ? current.professeurPrincipalId : input.professeurPrincipalId,
    })
    .where(eq(classe.id, id))
    .returning();
  return publicClasse(row, {});
}

export async function deleteClasse(session: SessionUser, id: string) {
  if (!canWriteReferential(session.role)) throw forbidden();
  const db = getDb();
  const [current] = await db.select({ id: classe.id }).from(classe).where(eq(classe.id, id)).limit(1);
  if (!current) throw notFound("Classe introuvable.");
  const [{ eleves }] = await db.select({ eleves: count() }).from(inscription).where(eq(inscription.classeId, id));
  const [{ evals }] = await db.select({ evals: count() }).from(evaluation).where(eq(evaluation.classeId, id));
  const [{ affectations }] = await db
    .select({ affectations: count() })
    .from(affectationEnseignant)
    .where(eq(affectationEnseignant.classeId, id));
  if (eleves > 0 || evals > 0 || affectations > 0) {
    throw new ApiError(409, "CONFLIT", "Impossible de supprimer une classe qui a des élèves, des affectations ou des évaluations.");
  }
  await db.delete(classe).where(eq(classe.id, id));
}

export async function assignEleve(session: SessionUser, classeId: string, body: unknown) {
  if (!canWriteStudents(session.role)) throw forbidden();
  const input = parseBody(inscriptionSchema, body);
  const db = getDb();
  const [classeRow] = await db.select().from(classe).where(eq(classe.id, classeId)).limit(1);
  if (!classeRow) throw notFound("Classe introuvable.");
  const [student] = await db.select().from(eleve).where(eq(eleve.id, input.eleveId)).limit(1);
  if (!student) throw notFound("Élève introuvable.");
  const statut = input.statut ?? "INSCRIT";
  const [existing] = await db
    .select()
    .from(inscription)
    .where(and(eq(inscription.eleveId, student.id), eq(inscription.anneeScolaireId, classeRow.anneeScolaireId)))
    .limit(1);
  if (existing) {
    const [row] = await db
      .update(inscription)
      .set({ classeId, statut })
      .where(eq(inscription.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(inscription)
    .values({
      eleveId: student.id,
      classeId,
      anneeScolaireId: classeRow.anneeScolaireId,
      statut,
    })
    .returning();
  return row;
}

export async function removeInscription(session: SessionUser, classeId: string, eleveId: string) {
  if (!canWriteStudents(session.role)) throw forbidden();
  const db = getDb();
  const [row] = await db
    .select()
    .from(inscription)
    .where(and(eq(inscription.classeId, classeId), eq(inscription.eleveId, eleveId)))
    .limit(1);
  if (!row) throw notFound("Inscription introuvable.");
  const [{ total }] = await db
    .select({ total: count() })
    .from(note)
    .innerJoin(evaluation, eq(note.evaluationId, evaluation.id))
    .where(and(eq(note.eleveId, eleveId), eq(evaluation.classeId, classeId)));
  if (total > 0) {
    throw new ApiError(409, "CONFLIT", "Impossible de retirer un élève qui a des notes dans cette classe.");
  }
  await db.delete(inscription).where(eq(inscription.id, row.id));
}

import { and, asc, count, eq } from "drizzle-orm";
import { affectationEnseignant, anneeScolaire, classe, evaluation, matiere, note, periode } from "@/db/schema";
import { canWriteGrades, type SessionUser } from "@/lib/auth/permissions";
import { assertWriteRate } from "@/lib/auth/rate-limit";
import { getDb } from "./db";
import { ApiError, forbidden, notFound } from "./errors";
import { optionalUuid, pagination, searchParams, versionOf } from "./query";
import { createEvaluationSchema, parseBody, patchEvaluationSchema } from "./schemas";
import {
  canReadClassSubject,
  canWriteClassSubject,
  closedYearError,
  loadScope,
  refuse,
  subjectIdsForClass,
  yearOfClass,
} from "./scope";

function publicEvaluation(row: typeof evaluation.$inferSelect) {
  return {
    id: row.id,
    classeId: row.classeId,
    matiereId: row.matiereId,
    enseignantId: row.enseignantId,
    periodeId: row.periodeId,
    type: row.type,
    libelle: row.libelle,
    date: row.date,
    noteMax: row.noteMax,
    coefficient: row.coefficient,
    version: versionOf(row.updatedAt),
  };
}

export async function listEvaluations(session: SessionUser, request: Request) {
  const params = searchParams(request);
  const page = pagination(params);
  const classeId = optionalUuid(params, "classeId");
  const matiereId = optionalUuid(params, "matiereId");
  const periodeId = optionalUuid(params, "periodeId");
  const scope = await loadScope(session);
  if (classeId && matiereId && !canReadClassSubject(scope, classeId, matiereId)) {
    return refuse(session, "GET", "evaluation", null, "Cette matière est hors de votre périmètre.");
  }
  const subjects = classeId ? subjectIdsForClass(scope, classeId) : null;
  if (classeId && subjects && subjects.length === 0) {
    return refuse(session, "GET", "evaluation", null, "Cette classe est hors de votre périmètre.");
  }

  const db = getDb();
  const filters = [];
  if (classeId) filters.push(eq(evaluation.classeId, classeId));
  if (matiereId) filters.push(eq(evaluation.matiereId, matiereId));
  if (periodeId) filters.push(eq(evaluation.periodeId, periodeId));
  const where = filters.length > 0 ? and(...filters) : undefined;
  const rows = await db
    .select()
    .from(evaluation)
    .where(where)
    .orderBy(asc(evaluation.date), asc(evaluation.libelle));
  const visible = rows.filter((row) => canReadClassSubject(scope, row.classeId, row.matiereId));
  return {
    data: visible.slice(page.offset, page.offset + page.pageSize).map(publicEvaluation),
    page: page.page,
    pageSize: page.pageSize,
    total: visible.length,
  };
}

async function assignedTeacher(classeId: string, matiereId: string, anneeScolaireId: string) {
  const [row] = await getDb()
    .select()
    .from(affectationEnseignant)
    .where(
      and(
        eq(affectationEnseignant.classeId, classeId),
        eq(affectationEnseignant.matiereId, matiereId),
        eq(affectationEnseignant.anneeScolaireId, anneeScolaireId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createEvaluation(session: SessionUser, body: unknown) {
  if (!canWriteGrades(session.role)) throw forbidden();
  assertWriteRate(session.id);
  const input = parseBody(createEvaluationSchema, body);
  const scope = await loadScope(session);
  const year = await yearOfClass(input.classeId);
  if (!year) throw notFound("Classe introuvable.");
  const closed = year.statut === "CLOTUREE";
  if (!canWriteClassSubject(scope, input.classeId, input.matiereId, closed)) {
    if (closed && session.role !== "ADMIN") throw closedYearError();
    return refuse(session, "POST", "evaluation", null, "Vous n'êtes pas affecté à cette classe et cette matière.");
  }
  const affectation = await assignedTeacher(input.classeId, input.matiereId, year.anneeScolaireId);
  if (!affectation) {
    throw new ApiError(422, "VALIDATION", "Aucun enseignant n'est affecté à cette classe et cette matière.");
  }
  if (session.role !== "ADMIN" && input.enseignantId && input.enseignantId !== session.enseignantId) {
    return refuse(session, "POST", "evaluation", null, "Vous ne pouvez pas créer une évaluation pour un autre enseignant.");
  }
  const enseignantId = session.role === "ADMIN" ? (input.enseignantId ?? affectation.enseignantId) : session.enseignantId;
  if (!enseignantId || enseignantId !== affectation.enseignantId) {
    throw new ApiError(422, "VALIDATION", "L'enseignant de l'évaluation doit être celui qui est affecté.");
  }
  const [periodeRow] = await getDb().select().from(periode).where(eq(periode.id, input.periodeId)).limit(1);
  if (!periodeRow) throw notFound("Période introuvable.");
  const [matiereRow] = await getDb().select({ id: matiere.id }).from(matiere).where(eq(matiere.id, input.matiereId)).limit(1);
  if (!matiereRow) throw notFound("Matière introuvable.");
  const [row] = await getDb()
    .insert(evaluation)
    .values({
      classeId: input.classeId,
      matiereId: input.matiereId,
      periodeId: input.periodeId,
      enseignantId,
      type: input.type,
      libelle: input.libelle,
      date: input.date,
      noteMax: input.noteMax,
      coefficient: input.coefficient,
    })
    .returning();
  return publicEvaluation(row);
}

export async function getEvaluation(session: SessionUser, id: string) {
  const [row] = await getDb().select().from(evaluation).where(eq(evaluation.id, id)).limit(1);
  if (!row) throw notFound("Évaluation introuvable.");
  const scope = await loadScope(session);
  if (!canReadClassSubject(scope, row.classeId, row.matiereId)) {
    return refuse(session, "GET", "evaluation", id, "Cette évaluation est hors de votre périmètre.");
  }
  return publicEvaluation(row);
}

export async function updateEvaluation(session: SessionUser, id: string, body: unknown) {
  if (!canWriteGrades(session.role)) throw forbidden();
  assertWriteRate(session.id);
  const input = parseBody(patchEvaluationSchema, body);
  const db = getDb();
  const [current] = await db.select().from(evaluation).where(eq(evaluation.id, id)).limit(1);
  if (!current) throw notFound("Évaluation introuvable.");
  const scope = await loadScope(session);
  const year = await yearOfClass(current.classeId);
  if (!year) throw notFound("Classe introuvable.");
  const closed = year.statut === "CLOTUREE";
  if (!canWriteClassSubject(scope, current.classeId, current.matiereId, closed)) {
    if (closed && session.role !== "ADMIN") throw closedYearError();
    return refuse(session, "PATCH", "evaluation", id, "Vous n'êtes pas affecté à cette classe et cette matière.");
  }
  const nextClasse = input.classeId ?? current.classeId;
  const nextMatiere = input.matiereId ?? current.matiereId;
  if (nextClasse !== current.classeId || nextMatiere !== current.matiereId) {
    if (!canWriteClassSubject(scope, nextClasse, nextMatiere, closed)) {
      return refuse(session, "PATCH", "evaluation", id, "Vous n'êtes pas affecté à cette classe et cette matière.");
    }
  }
  const [row] = await db
    .update(evaluation)
    .set({
      classeId: nextClasse,
      matiereId: nextMatiere,
      periodeId: input.periodeId ?? current.periodeId,
      enseignantId: current.enseignantId,
      type: input.type ?? current.type,
      libelle: input.libelle ?? current.libelle,
      date: input.date ?? current.date,
      noteMax: input.noteMax ?? current.noteMax,
      coefficient: input.coefficient ?? current.coefficient,
    })
    .where(eq(evaluation.id, id))
    .returning();
  return publicEvaluation(row);
}

export async function deleteEvaluation(session: SessionUser, id: string) {
  if (!canWriteGrades(session.role)) throw forbidden();
  assertWriteRate(session.id);
  const db = getDb();
  const [current] = await db.select().from(evaluation).where(eq(evaluation.id, id)).limit(1);
  if (!current) throw notFound("Évaluation introuvable.");
  const scope = await loadScope(session);
  const year = await yearOfClass(current.classeId);
  const closed = year?.statut === "CLOTUREE";
  if (!canWriteClassSubject(scope, current.classeId, current.matiereId, Boolean(closed))) {
    if (closed && session.role !== "ADMIN") throw closedYearError();
    return refuse(session, "DELETE", "evaluation", id, "Vous n'êtes pas affecté à cette classe et cette matière.");
  }
  const [{ total }] = await db.select({ total: count() }).from(note).where(eq(note.evaluationId, id));
  if (total > 0) {
    throw new ApiError(409, "CONFLIT", "Retirez les notes avant de supprimer l'évaluation.");
  }
  await db.delete(evaluation).where(eq(evaluation.id, id));
}

export async function loadEvaluationContext(id: string) {
  const [row] = await getDb()
    .select({
      evaluation,
      statut: anneeScolaire.statut,
      anneeScolaireId: classe.anneeScolaireId,
    })
    .from(evaluation)
    .innerJoin(classe, eq(evaluation.classeId, classe.id))
    .innerJoin(anneeScolaire, eq(classe.anneeScolaireId, anneeScolaire.id))
    .where(eq(evaluation.id, id))
    .limit(1);
  return row ?? null;
}

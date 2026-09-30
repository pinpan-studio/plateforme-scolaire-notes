import { and, asc, count, eq, ilike, inArray } from "drizzle-orm";
import { affectationEnseignant, anneeScolaire, classe, enseignant, evaluation, inscription, matiere, note, periode } from "@/db/schema";
import { canWriteGrades, type SessionUser } from "@/lib/auth/permissions";
import { assertSearchRate, assertWriteRate } from "@/lib/auth/rate-limit";
import { getDb } from "./db";
import { ApiError, forbidden, notFound } from "./errors";
import { likePattern, optionalUuid, pagination, searchParams, searchQuery, versionOf } from "./query";
import { auditPour, writeAudit } from "./audit";
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

async function presentEvaluations(rows: Array<typeof evaluation.$inferSelect>) {
  if (rows.length === 0) return [];
  const db = getDb();
  const classeIds = [...new Set(rows.map((row) => row.classeId))];
  const matiereIds = [...new Set(rows.map((row) => row.matiereId))];
  const periodeIds = [...new Set(rows.map((row) => row.periodeId))];
  const enseignantIds = [...new Set(rows.map((row) => row.enseignantId))];
  const evaluationIds = rows.map((row) => row.id);
  const [classes, matieres, periodes, enseignants, saisies, effectifs] = await Promise.all([
    db.select({ id: classe.id, nom: classe.nom, anneeScolaireId: classe.anneeScolaireId }).from(classe).where(inArray(classe.id, classeIds)),
    db.select({ id: matiere.id, nom: matiere.nom }).from(matiere).where(inArray(matiere.id, matiereIds)),
    db.select({ id: periode.id, libelle: periode.libelle }).from(periode).where(inArray(periode.id, periodeIds)),
    db
      .select({ id: enseignant.id, nom: enseignant.nom, prenom: enseignant.prenom })
      .from(enseignant)
      .where(inArray(enseignant.id, enseignantIds)),
    db
      .select({ evaluationId: note.evaluationId, total: count() })
      .from(note)
      .where(inArray(note.evaluationId, evaluationIds))
      .groupBy(note.evaluationId),
    db
      .select({ classeId: inscription.classeId, total: count() })
      .from(inscription)
      .where(and(inArray(inscription.classeId, classeIds), eq(inscription.statut, "INSCRIT")))
      .groupBy(inscription.classeId),
  ]);
  const classeParId = new Map(classes.map((row) => [row.id, row]));
  const matiereParId = new Map(matieres.map((row) => [row.id, row.nom]));
  const periodeParId = new Map(periodes.map((row) => [row.id, row.libelle]));
  const enseignantParId = new Map(enseignants.map((row) => [row.id, `${row.prenom} ${row.nom}`]));
  const saisiesParId = new Map(saisies.map((row) => [row.evaluationId, row.total]));
  const effectifParClasse = new Map(effectifs.map((row) => [row.classeId, row.total]));
  return rows.map((row) => {
    const notesSaisies = saisiesParId.get(row.id) ?? 0;
    return {
      ...publicEvaluation(row),
      classe: classeParId.get(row.classeId)?.nom ?? "",
      matiere: matiereParId.get(row.matiereId) ?? "",
      periode: periodeParId.get(row.periodeId) ?? "",
      enseignant: enseignantParId.get(row.enseignantId) ?? "",
      anneeScolaireId: classeParId.get(row.classeId)?.anneeScolaireId ?? null,
      saisies: notesSaisies,
      effectif: effectifParClasse.get(row.classeId) ?? 0,
      supprimable: notesSaisies === 0,
      motifSuppression: notesSaisies === 0 ? null : "Des notes sont déjà saisies. La suppression est impossible.",
    };
  });
}

export async function listEvaluations(session: SessionUser, request: Request) {
  const params = searchParams(request);
  const page = pagination(params);
  const classeId = optionalUuid(params, "classeId");
  const matiereId = optionalUuid(params, "matiereId");
  const periodeId = optionalUuid(params, "periodeId");
  const anneeScolaireId = optionalUuid(params, "anneeScolaireId");
  const q = searchQuery(params);
  if (q) assertSearchRate(session.id);
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
  if (anneeScolaireId) filters.push(eq(classe.anneeScolaireId, anneeScolaireId));
  if (q) filters.push(ilike(evaluation.libelle, likePattern(q)));
  const where = filters.length > 0 ? and(...filters) : undefined;
  const rows = await db
    .select({ evaluation })
    .from(evaluation)
    .innerJoin(classe, eq(evaluation.classeId, classe.id))
    .where(where)
    .orderBy(asc(evaluation.date), asc(evaluation.libelle));
  const visible = rows.map((row) => row.evaluation).filter((row) => canReadClassSubject(scope, row.classeId, row.matiereId));
  const pageRows = visible.slice(page.offset, page.offset + page.pageSize);
  return {
    data: await presentEvaluations(pageRows),
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
  const [presented] = await presentEvaluations([row]);
  return presented;
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
  const row = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(evaluation).where(eq(evaluation.id, id)).limit(1).for("update");
    if (!locked) throw notFound("Évaluation introuvable.");
    const classeId = input.classeId ?? locked.classeId;
    const matiereId = input.matiereId ?? locked.matiereId;
    const periodeId = input.periodeId ?? locked.periodeId;
    const noteMax = input.noteMax ?? locked.noteMax;
    const coefficient = input.coefficient ?? locked.coefficient;
    const classeChange = classeId !== locked.classeId;
    const matiereChange = matiereId !== locked.matiereId;
    const periodeChange = periodeId !== locked.periodeId;
    const noteMaxChange = Number(noteMax) !== Number(locked.noteMax);
    const coefficientChange = Number(coefficient) !== Number(locked.coefficient);
    if (classeChange || matiereChange || periodeChange || noteMaxChange) {
      const [{ total }] = await tx.select({ total: count() }).from(note).where(eq(note.evaluationId, id));
      if (total > 0) {
        const message =
          "Impossible de modifier la classe, la matière, la période ou la note maximale tant que des notes existent.";
        const code = classeChange || matiereChange || periodeChange ? "EVALUATION_DEJA_NOTEE" : "NOTE_MAX_FIGEE";
        throw new ApiError(409, code, message);
      }
    }
    const [updated] = await tx
      .update(evaluation)
      .set({
        classeId,
        matiereId,
        periodeId,
        enseignantId: locked.enseignantId,
        type: input.type ?? locked.type,
        libelle: input.libelle ?? locked.libelle,
        date: input.date ?? locked.date,
        noteMax,
        coefficient,
      })
      .where(eq(evaluation.id, id))
      .returning();
    if (noteMaxChange || coefficientChange) {
      await writeAudit(
        auditPour(session, {
          type: "BAREME_MODIFICATION",
          resultat: "200",
          action: "PATCH",
          cibleType: "evaluation",
          cibleId: updated.id,
          ancienneValeur: JSON.stringify({
            ...(noteMaxChange ? { noteMax: locked.noteMax } : {}),
            ...(coefficientChange ? { coefficient: locked.coefficient } : {}),
          }),
          nouvelleValeur: JSON.stringify({
            ...(noteMaxChange ? { noteMax: updated.noteMax } : {}),
            ...(coefficientChange ? { coefficient: updated.coefficient } : {}),
          }),
        }),
        tx,
      );
    }
    return updated;
  });
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

import { createHash } from "node:crypto";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { eleve, evaluation, inscription, journalAudit, note } from "@/db/schema";
import { canWriteGrades, type SessionUser } from "@/lib/auth/permissions";
import { assertWriteRate, consumeValidationAttempt } from "@/lib/auth/rate-limit";
import { getDb, type Database } from "./db";
import { writeAudit } from "./audit";
import { ApiError, forbidden, notFound } from "./errors";
import { assertVersion, optionalUuid, pagination, searchParams, versionOf } from "./query";
import { createNoteSchema, lotNotesSchema, parseBody, patchNoteSchema } from "./schemas";
import { canReadClassSubject, canWriteClassSubject, closedYearError, loadScope, refuse } from "./scope";
import { loadEvaluationContext } from "./evaluations";

type NoteInput = {
  evaluationId: string;
  eleveId: string;
  valeur: number | null;
  estAbsent: boolean;
  commentaire?: string | null;
};

function publicNote(
  row: typeof note.$inferSelect,
  extra?: { classeId?: string; matiereId?: string; noteMax?: number },
) {
  return {
    id: row.id,
    eleveId: row.eleveId,
    evaluationId: row.evaluationId,
    valeur: row.valeur,
    estAbsent: row.estAbsent,
    commentaire: row.commentaire,
    classeId: extra?.classeId ?? null,
    matiereId: extra?.matiereId ?? null,
    noteMax: extra?.noteMax ?? null,
    version: versionOf(row.updatedAt),
  };
}

function formatValeur(valeur: number | null, estAbsent: boolean) {
  return estAbsent || valeur === null ? "absent" : String(valeur);
}

async function assertLine(input: NoteInput, session: SessionUser, action: string) {
  const scope = await loadScope(session);
  const context = await loadEvaluationContext(input.evaluationId);
  if (!context) throw notFound("Évaluation introuvable.");
  const closed = context.statut === "CLOTUREE";
  if (!canWriteClassSubject(scope, context.evaluation.classeId, context.evaluation.matiereId, closed)) {
    if (closed && session.role !== "ADMIN") throw closedYearError();
    return refuse(
      session,
      action,
      "evaluation",
      context.evaluation.id,
      "Vous n'êtes pas affecté à cette classe et cette matière.",
    );
  }
  if (!input.estAbsent && input.valeur !== null && input.valeur > context.evaluation.noteMax) {
    throw new ApiError(422, "VALIDATION", "La note dépasse le barème de l'évaluation.", [
      { path: "valeur", message: "Supérieure à la note maximale." },
    ]);
  }
  const [inscrit] = await getDb()
    .select({ id: inscription.id })
    .from(inscription)
    .where(
      and(
        eq(inscription.eleveId, input.eleveId),
        eq(inscription.classeId, context.evaluation.classeId),
        eq(inscription.statut, "INSCRIT"),
      ),
    )
    .limit(1);
  if (!inscrit) {
    throw new ApiError(422, "VALIDATION", "L'élève n'est pas inscrit dans la classe de l'évaluation.", [
      { path: "eleveId", message: "Élève hors classe." },
    ]);
  }
  const [student] = await getDb().select({ id: eleve.id }).from(eleve).where(eq(eleve.id, input.eleveId)).limit(1);
  if (!student) throw notFound("Élève introuvable.");
  return context;
}

export async function listNotes(session: SessionUser, request: Request) {
  const params = searchParams(request);
  const page = pagination(params);
  const evaluationId = optionalUuid(params, "evaluationId");
  const eleveId = optionalUuid(params, "eleveId");
  const classeId = optionalUuid(params, "classeId");
  const matiereId = optionalUuid(params, "matiereId");
  const scope = await loadScope(session);
  if (evaluationId) {
    const context = await loadEvaluationContext(evaluationId);
    if (!context) throw notFound("Évaluation introuvable.");
    if (!canReadClassSubject(scope, context.evaluation.classeId, context.evaluation.matiereId)) {
      return refuse(session, "GET", "note", null, "Ces notes sont hors de votre périmètre.");
    }
  }
  if (classeId && matiereId && !canReadClassSubject(scope, classeId, matiereId)) {
    return refuse(session, "GET", "note", null, "Ces notes sont hors de votre périmètre.");
  }

  const db = getDb();
  const filters = [];
  if (evaluationId) filters.push(eq(note.evaluationId, evaluationId));
  if (eleveId) filters.push(eq(note.eleveId, eleveId));
  if (classeId) filters.push(eq(evaluation.classeId, classeId));
  if (matiereId) filters.push(eq(evaluation.matiereId, matiereId));
  const where = filters.length > 0 ? and(...filters) : undefined;
  const rows = await db
    .select({ note, classeId: evaluation.classeId, matiereId: evaluation.matiereId, noteMax: evaluation.noteMax })
    .from(note)
    .innerJoin(evaluation, eq(note.evaluationId, evaluation.id))
    .innerJoin(eleve, eq(note.eleveId, eleve.id))
    .where(where)
    .orderBy(asc(eleve.nom), asc(eleve.prenom));

  const visible = rows.filter((row) => canReadClassSubject(scope, row.classeId, row.matiereId));
  if ((evaluationId || (classeId && matiereId)) && visible.length === 0 && rows.length > 0) {
    return refuse(session, "GET", "note", evaluationId ?? null, "Ces notes sont hors de votre périmètre.");
  }
  return {
    data: visible.slice(page.offset, page.offset + page.pageSize).map((row) => publicNote(row.note, row)),
    page: page.page,
    pageSize: page.pageSize,
    total: visible.length,
  };
}

export async function getNote(session: SessionUser, id: string) {
  const db = getDb();
  const [row] = await db
    .select({ note, classeId: evaluation.classeId, matiereId: evaluation.matiereId, noteMax: evaluation.noteMax })
    .from(note)
    .innerJoin(evaluation, eq(note.evaluationId, evaluation.id))
    .where(eq(note.id, id))
    .limit(1);
  if (!row) throw notFound("Note introuvable.");
  const scope = await loadScope(session);
  if (!canReadClassSubject(scope, row.classeId, row.matiereId)) {
    return refuse(session, "GET", "note", id, "Cette note est hors de votre périmètre.");
  }
  return publicNote(row.note, row);
}

export async function createNote(session: SessionUser, body: unknown) {
  if (!canWriteGrades(session.role)) throw forbidden();
  assertWriteRate(session.id);
  const input = parseBody(createNoteSchema, body);
  const context = await assertLine(input, session, "POST");
  const db = getDb();
  const [existing] = await db
    .select({ id: note.id })
    .from(note)
    .where(and(eq(note.eleveId, input.eleveId), eq(note.evaluationId, input.evaluationId)))
    .limit(1);
  if (existing) throw new ApiError(409, "CONFLIT", "Cette note existe déjà.");
  const [row] = await db
    .insert(note)
    .values({
      eleveId: input.eleveId,
      evaluationId: input.evaluationId,
      valeur: input.estAbsent ? null : input.valeur,
      estAbsent: input.estAbsent,
      commentaire: input.commentaire ?? null,
    })
    .returning();
  await writeAudit({
    type: "NOTE_CREATION",
    acteurId: session.id,
    identifiant: session.email,
    resultat: "201",
    action: "POST",
    cibleType: "note",
    cibleId: row.id,
    nouvelleValeur: formatValeur(row.valeur, row.estAbsent),
  });
  return publicNote(row, {
    classeId: context.evaluation.classeId,
    matiereId: context.evaluation.matiereId,
    noteMax: context.evaluation.noteMax,
  });
}

export async function updateNote(session: SessionUser, id: string, body: unknown) {
  if (!canWriteGrades(session.role)) throw forbidden();
  assertWriteRate(session.id);
  const input = parseBody(patchNoteSchema, body);
  const db = getDb();
  const [current] = await db.select().from(note).where(eq(note.id, id)).limit(1);
  if (!current) throw notFound("Note introuvable.");
  assertVersion(current.updatedAt, input.version);
  const estAbsent = input.estAbsent ?? current.estAbsent;
  const valeur = input.valeur === undefined ? current.valeur : input.valeur;
  const next = {
    evaluationId: current.evaluationId,
    eleveId: current.eleveId,
    valeur: estAbsent ? null : valeur,
    estAbsent,
    commentaire: input.commentaire === undefined ? current.commentaire : input.commentaire,
  };
  if (estAbsent && input.valeur !== undefined && input.valeur !== null && input.estAbsent !== false) {
    throw new ApiError(422, "VALIDATION", "Une absence n'a pas de valeur numérique.", [
      { path: "valeur", message: "Une absence n'a pas de valeur numérique." },
    ]);
  }
  if (!estAbsent && next.valeur === null) {
    throw new ApiError(422, "VALIDATION", "Une présence doit avoir une valeur.", [
      { path: "valeur", message: "Valeur requise." },
    ]);
  }
  const context = await assertLine(next, session, "PATCH");
  const [row] = await db
    .update(note)
    .set({
      valeur: next.valeur,
      estAbsent: next.estAbsent,
      commentaire: next.commentaire,
    })
    .where(eq(note.id, id))
    .returning();
  await writeAudit({
    type: "NOTE_MODIFICATION",
    acteurId: session.id,
    identifiant: session.email,
    resultat: "200",
    action: "PATCH",
    cibleType: "note",
    cibleId: row.id,
    ancienneValeur: formatValeur(current.valeur, current.estAbsent),
    nouvelleValeur: formatValeur(row.valeur, row.estAbsent),
  });
  return publicNote(row, {
    classeId: context.evaluation.classeId,
    matiereId: context.evaluation.matiereId,
    noteMax: context.evaluation.noteMax,
  });
}

export async function deleteNote(session: SessionUser, id: string) {
  if (!canWriteGrades(session.role)) throw forbidden();
  assertWriteRate(session.id);
  const db = getDb();
  const [current] = await db.select().from(note).where(eq(note.id, id)).limit(1);
  if (!current) throw notFound("Note introuvable.");
  await assertLine(
    {
      evaluationId: current.evaluationId,
      eleveId: current.eleveId,
      valeur: current.valeur,
      estAbsent: current.estAbsent,
    },
    session,
    "DELETE",
  );
  await db.delete(note).where(eq(note.id, id));
  await writeAudit({
    type: "NOTE_SUPPRESSION",
    acteurId: session.id,
    identifiant: session.email,
    resultat: "204",
    action: "DELETE",
    cibleType: "note",
    cibleId: id,
    ancienneValeur: formatValeur(current.valeur, current.estAbsent),
  });
}

type PreparedLine = NoteInput & {
  classeId: string;
  matiereId: string;
  existingId: string | null;
  ancienne: string | null;
};

async function prepareLot(session: SessionUser, body: unknown, action: string): Promise<PreparedLine[]> {
  const input = parseBody(lotNotesSchema, body);
  const lignes = input.lignes.map((ligne, index) => {
    const evaluationId = ligne.evaluationId ?? input.evaluationId;
    if (!evaluationId) {
      throw new ApiError(422, "VALIDATION", "Évaluation requise.", [
        { path: `lignes.${index}.evaluationId`, message: "UUID attendu." },
      ]);
    }
    return { ...ligne, evaluationId, index };
  });
  const scope = await loadScope(session);
  const db = getDb();
  const prepared: PreparedLine[] = [];
  for (const ligne of lignes) {
    const context = await loadEvaluationContext(ligne.evaluationId);
    if (!context) throw notFound("Évaluation introuvable.");
    const closed = context.statut === "CLOTUREE";
    if (!canWriteClassSubject(scope, context.evaluation.classeId, context.evaluation.matiereId, closed)) {
      if (closed && session.role !== "ADMIN") throw closedYearError();
      return refuse(
        session,
        action,
        "evaluation",
        context.evaluation.id,
        "Vous n'êtes pas affecté à cette classe et cette matière.",
      );
    }
    if (!ligne.estAbsent && ligne.valeur !== null && ligne.valeur > context.evaluation.noteMax) {
      throw new ApiError(422, "VALIDATION", "La note dépasse le barème de l'évaluation.", [
        { path: `lignes.${ligne.index}.valeur`, message: "Supérieure à la note maximale." },
      ]);
    }
    const [inscrit] = await db
      .select({ id: inscription.id })
      .from(inscription)
      .where(
        and(
          eq(inscription.eleveId, ligne.eleveId),
          eq(inscription.classeId, context.evaluation.classeId),
          eq(inscription.statut, "INSCRIT"),
        ),
      )
      .limit(1);
    if (!inscrit) {
      throw new ApiError(422, "VALIDATION", "L'élève n'est pas inscrit dans la classe de l'évaluation.", [
        { path: `lignes.${ligne.index}.eleveId`, message: "Élève hors classe." },
      ]);
    }
    const [existing] = await db
      .select()
      .from(note)
      .where(and(eq(note.eleveId, ligne.eleveId), eq(note.evaluationId, ligne.evaluationId)))
      .limit(1);
    prepared.push({
      evaluationId: ligne.evaluationId,
      eleveId: ligne.eleveId,
      valeur: ligne.estAbsent ? null : ligne.valeur,
      estAbsent: ligne.estAbsent,
      commentaire: ligne.commentaire ?? null,
      classeId: context.evaluation.classeId,
      matiereId: context.evaluation.matiereId,
      existingId: existing?.id ?? null,
      ancienne: existing ? formatValeur(existing.valeur, existing.estAbsent) : null,
    });
  }
  return prepared;
}

async function persistLot(session: SessionUser, lignes: PreparedLine[], db: Database) {
  return db.transaction(async (tx) => {
    const saved = [];
    for (const ligne of lignes) {
      if (ligne.existingId) {
        const [row] = await tx
          .update(note)
          .set({
            valeur: ligne.valeur,
            estAbsent: ligne.estAbsent,
            commentaire: ligne.commentaire ?? null,
          })
          .where(eq(note.id, ligne.existingId))
          .returning();
        await writeAudit(
          {
            type: "NOTE_MODIFICATION",
            acteurId: session.id,
            identifiant: session.email,
            resultat: "200",
            action: "LOT",
            cibleType: "note",
            cibleId: row.id,
            ancienneValeur: ligne.ancienne,
            nouvelleValeur: formatValeur(row.valeur, row.estAbsent),
          },
          tx,
        );
        saved.push(publicNote(row, ligne));
      } else {
        const [row] = await tx
          .insert(note)
          .values({
            eleveId: ligne.eleveId,
            evaluationId: ligne.evaluationId,
            valeur: ligne.valeur,
            estAbsent: ligne.estAbsent,
            commentaire: ligne.commentaire ?? null,
          })
          .returning();
        await writeAudit(
          {
            type: "NOTE_CREATION",
            acteurId: session.id,
            identifiant: session.email,
            resultat: "201",
            action: "LOT",
            cibleType: "note",
            cibleId: row.id,
            nouvelleValeur: formatValeur(row.valeur, row.estAbsent),
          },
          tx,
        );
        saved.push(publicNote(row, ligne));
      }
    }
    return saved;
  });
}

export async function saveLot(session: SessionUser, body: unknown) {
  if (!canWriteGrades(session.role)) throw forbidden();
  assertWriteRate(session.id);
  const lignes = await prepareLot(session, body, "POST");
  const saved = await persistLot(session, lignes, getDb());
  return { data: saved, total: saved.length };
}

function validationFingerprint(lignes: PreparedLine[]): { cibleId: string | null; valeur: string } {
  const canonical = lignes
    .map((ligne) =>
      [ligne.evaluationId, ligne.eleveId, ligne.estAbsent ? "absent" : String(ligne.valeur), ligne.commentaire ?? ""].join(
        ":",
      ),
    )
    .sort()
    .join("|");
  const hash = createHash("sha256").update(canonical).digest("hex");
  const evaluations = new Set(lignes.map((ligne) => ligne.evaluationId));
  return {
    cibleId: evaluations.size === 1 ? (lignes[0]?.evaluationId ?? null) : null,
    valeur: `${lignes.length}:${hash}`,
  };
}

/**
 * Trace une validation effective, une fois par état.
 * Un rappel identique (même évaluation, mêmes valeurs) ne rajoute pas de ligne :
 * le journal ne se remplit pas à chaque appel. Un état différent — valeur,
 * absence ou commentaire — produit une nouvelle ligne. L'empreinte ne contient
 * pas les notes en clair.
 */
async function auditValidation(session: SessionUser, lignes: PreparedLine[]): Promise<void> {
  const fingerprint = validationFingerprint(lignes);
  const [last] = await getDb()
    .select({ nouvelleValeur: journalAudit.nouvelleValeur })
    .from(journalAudit)
    .where(
      and(
        eq(journalAudit.type, "NOTE_VALIDATION"),
        eq(journalAudit.acteurId, session.id),
        eq(journalAudit.action, "VALIDER"),
        fingerprint.cibleId === null
          ? isNull(journalAudit.cibleId)
          : eq(journalAudit.cibleId, fingerprint.cibleId),
      ),
    )
    .orderBy(desc(journalAudit.createdAt))
    .limit(1);
  if (last?.nouvelleValeur === fingerprint.valeur) return;
  await writeAudit({
    type: "NOTE_VALIDATION",
    acteurId: session.id,
    identifiant: session.email,
    resultat: "200",
    action: "VALIDER",
    cibleType: "note",
    cibleId: fingerprint.cibleId,
    nouvelleValeur: fingerprint.valeur,
  });
}

export async function validateNotes(session: SessionUser, body: unknown, ip: string) {
  if (!canWriteGrades(session.role)) throw forbidden();
  await consumeValidationAttempt(session.id, ip);
  const record = body && typeof body === "object" && "lignes" in body ? body : { lignes: [body] };
  const lignes = await prepareLot(session, record, "POST");
  await auditValidation(session, lignes);
  return { valide: true, lignes: lignes.length };
}

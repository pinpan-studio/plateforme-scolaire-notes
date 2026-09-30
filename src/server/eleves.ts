import { and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { classe, eleve, evaluation, inscription, note } from "@/db/schema";
import { canWriteStudents, type SessionUser } from "@/lib/auth/permissions";
import { getDb } from "./db";
import { ApiError, forbidden, notFound } from "./errors";
import { assertVersion, likePattern, optionalUuid, pagination, searchParams, searchQuery, sortOrder, versionOf } from "./query";
import { assertSearchRate } from "@/lib/auth/rate-limit";
import { createEleveSchema, parseBody, patchEleveSchema } from "./schemas";
import { canReadClass, classIdsInScope, loadScope } from "./scope";

function inscriptionStatut(statut: string) {
  if (statut === "SORTI") return "SORTI" as const;
  if (statut === "TRANSFERE") return "TRANSFERE" as const;
  return "INSCRIT" as const;
}

/** L'interface parle d'inscription (`INSCRIT`). La fiche élève stocke `ACTIF`. */
function statutFiche(statut: string | undefined, courant: string): "ACTIF" | "SORTI" | "TRANSFERE" {
  if (statut === "SORTI" || statut === "TRANSFERE") return statut;
  if (statut === "ACTIF" || statut === "INSCRIT") return "ACTIF";
  if (courant === "SORTI" || courant === "TRANSFERE") return courant;
  return "ACTIF";
}

function publicEleve(
  row: typeof eleve.$inferSelect,
  inscriptionRow?: {
    id: string;
    classeId: string;
    anneeScolaireId: string;
    statut: string;
    classeNom?: string;
  } | null,
) {
  return {
    id: row.id,
    matricule: row.matricule,
    nom: row.nom,
    prenom: row.prenom,
    dateNaissance: row.dateNaissance,
    sexe: row.sexe,
    statut: row.statut,
    version: versionOf(row.updatedAt),
    inscription: inscriptionRow
      ? {
          id: inscriptionRow.id,
          classeId: inscriptionRow.classeId,
          classeNom: inscriptionRow.classeNom ?? null,
          anneeScolaireId: inscriptionRow.anneeScolaireId,
          statut: inscriptionRow.statut,
        }
      : null,
  };
}

async function assertReadableStudent(session: SessionUser, eleveId: string) {
  const scope = await loadScope(session);
  const allowed = classIdsInScope(scope);
  if (allowed === null) return scope;
  if (allowed.length === 0) {
    throw forbidden("Cet élève est hors de votre périmètre.");
  }
  const [row] = await getDb()
    .select({ id: inscription.id })
    .from(inscription)
    .where(and(eq(inscription.eleveId, eleveId), inArray(inscription.classeId, allowed)))
    .limit(1);
  if (!row) throw forbidden("Cet élève est hors de votre périmètre.");
  return scope;
}

export async function listEleves(session: SessionUser, request: Request) {
  const params = searchParams(request);
  const page = pagination(params);
  const q = searchQuery(params);
  if (q) assertSearchRate(session.id);
  const classeId = params.get("classeId");
  const parsedClasse = classeId
    ? (() => {
        if (!/^[0-9a-f-]{36}$/i.test(classeId)) {
          throw new ApiError(422, "VALIDATION", "Identifiant invalide.", [
            { path: "classeId", message: "UUID attendu." },
          ]);
        }
        return classeId;
      })()
    : undefined;
  const statut = params.get("statut");
  const anneeScolaireId = optionalUuid(params, "anneeScolaireId");
  if (statut && !["ACTIF", "INSCRIT", "SORTI", "TRANSFERE"].includes(statut)) {
    throw new ApiError(422, "VALIDATION", "Statut invalide.", [{ path: "statut", message: "Statut inconnu." }]);
  }
  const { sort, order } = sortOrder(params, ["nom", "prenom", "matricule"], "nom");
  const scope = await loadScope(session);
  const allowed = classIdsInScope(scope);
  if (parsedClasse && !canReadClass(scope, parsedClasse)) {
    throw forbidden("Cette classe est hors de votre périmètre.");
  }

  const db = getDb();
  const filters = [];
  if (q) {
    const pattern = likePattern(q);
    filters.push(or(ilike(eleve.nom, pattern), ilike(eleve.prenom, pattern), ilike(eleve.matricule, pattern))!);
  }
  let needsJoin = Boolean(parsedClasse) || allowed !== null || Boolean(anneeScolaireId);
  if (parsedClasse) filters.push(eq(inscription.classeId, parsedClasse));
  if (anneeScolaireId) filters.push(eq(inscription.anneeScolaireId, anneeScolaireId));
  if (statut === "INSCRIT" || statut === "SORTI" || statut === "TRANSFERE") {
    filters.push(eq(inscription.statut, statut));
    needsJoin = true;
  } else if (statut === "ACTIF") {
    filters.push(eq(eleve.statut, "ACTIF"));
  }
  if (allowed) {
    if (allowed.length === 0) {
      return { data: [], page: page.page, pageSize: page.pageSize, total: 0 };
    }
    filters.push(inArray(inscription.classeId, allowed));
  }
  const where = filters.length > 0 ? and(...filters) : undefined;
  const sortColumn = sort === "prenom" ? eleve.prenom : sort === "matricule" ? eleve.matricule : eleve.nom;
  const direction = order === "desc" ? desc(sortColumn) : asc(sortColumn);

  const base = needsJoin
    ? db.select({ id: eleve.id }).from(eleve).innerJoin(inscription, eq(inscription.eleveId, eleve.id)).where(where)
    : db.select({ id: eleve.id }).from(eleve).where(where);

  const [{ total }] = needsJoin
    ? await db
        .select({ total: count() })
        .from(eleve)
        .innerJoin(inscription, eq(inscription.eleveId, eleve.id))
        .where(where)
    : await db.select({ total: count() }).from(eleve).where(where);

  const ids = await base.orderBy(direction, asc(eleve.prenom)).limit(page.pageSize).offset(page.offset);
  if (ids.length === 0) {
    return { data: [], page: page.page, pageSize: page.pageSize, total };
  }

  const rows = await db
    .select({
      eleve,
      inscriptionId: inscription.id,
      classeId: inscription.classeId,
      anneeScolaireId: inscription.anneeScolaireId,
      inscriptionStatut: inscription.statut,
      classeNom: classe.nom,
    })
    .from(eleve)
    .leftJoin(inscription, eq(inscription.eleveId, eleve.id))
    .leftJoin(classe, eq(inscription.classeId, classe.id))
    .where(inArray(eleve.id, ids.map((row) => row.id)));

  const byId = new Map<string, ReturnType<typeof publicEleve>>();
  for (const row of rows) {
    if (byId.has(row.eleve.id)) continue;
    const matchesClass = !parsedClasse || row.classeId === parsedClasse;
    byId.set(
      row.eleve.id,
      publicEleve(
        row.eleve,
        matchesClass && row.inscriptionId && row.classeId && row.anneeScolaireId
          ? {
              id: row.inscriptionId,
              classeId: row.classeId,
              anneeScolaireId: row.anneeScolaireId,
              statut: row.inscriptionStatut ?? "INSCRIT",
              classeNom: row.classeNom ?? undefined,
            }
          : null,
      ),
    );
  }

  return {
    data: ids.map((row) => byId.get(row.id)).filter((row) => row !== undefined),
    page: page.page,
    pageSize: page.pageSize,
    total,
  };
}

export async function getEleve(session: SessionUser, id: string) {
  const [row] = await getDb().select().from(eleve).where(eq(eleve.id, id)).limit(1);
  if (!row) throw notFound("Élève introuvable.");
  await assertReadableStudent(session, id);
  const [link] = await getDb()
    .select({
      id: inscription.id,
      classeId: inscription.classeId,
      anneeScolaireId: inscription.anneeScolaireId,
      statut: inscription.statut,
      classeNom: classe.nom,
    })
    .from(inscription)
    .innerJoin(classe, eq(inscription.classeId, classe.id))
    .where(eq(inscription.eleveId, id))
    .limit(1);
  return publicEleve(row, link ?? null);
}

export async function createEleve(session: SessionUser, body: unknown) {
  if (!canWriteStudents(session.role)) throw forbidden();
  const input = parseBody(createEleveSchema, body);
  const db = getDb();
  const [classeRow] = await db.select().from(classe).where(eq(classe.id, input.classeId)).limit(1);
  if (!classeRow) throw notFound("Classe introuvable.");
  const statut = input.statut === "SORTI" || input.statut === "TRANSFERE" ? input.statut : "ACTIF";
  const created = await db.transaction(async (tx) => {
    const [student] = await tx
      .insert(eleve)
      .values({
        matricule: input.matricule,
        nom: input.nom,
        prenom: input.prenom,
        dateNaissance: input.dateNaissance,
        sexe: input.sexe,
        statut,
      })
      .returning();
    const [link] = await tx
      .insert(inscription)
      .values({
        eleveId: student.id,
        classeId: classeRow.id,
        anneeScolaireId: classeRow.anneeScolaireId,
        statut: inscriptionStatut(statut),
      })
      .returning();
    return publicEleve(student, { ...link, classeNom: classeRow.nom });
  });
  return created;
}

export async function updateEleve(session: SessionUser, id: string, body: unknown) {
  if (!canWriteStudents(session.role)) throw forbidden();
  const input = parseBody(patchEleveSchema, body);
  const db = getDb();
  const [current] = await db.select().from(eleve).where(eq(eleve.id, id)).limit(1);
  if (!current) throw notFound("Élève introuvable.");
  assertVersion(current.updatedAt, input.version);
  const statut = statutFiche(input.statut, current.statut);

  return db.transaction(async (tx) => {
    const [locked] = await tx.select({ id: eleve.id }).from(eleve).where(eq(eleve.id, id)).limit(1).for("update");
    if (!locked) throw notFound("Élève introuvable.");
    const [student] = await tx
      .update(eleve)
      .set({
        nom: input.nom ?? current.nom,
        prenom: input.prenom ?? current.prenom,
        dateNaissance: input.dateNaissance ?? current.dateNaissance,
        sexe: input.sexe ?? current.sexe,
        statut,
      })
      .where(eq(eleve.id, id))
      .returning();

    let link: {
      id: string;
      classeId: string;
      anneeScolaireId: string;
      statut: string;
      classeNom?: string;
    } | null = null;

    if (input.classeId) {
      const [classeRow] = await tx.select().from(classe).where(eq(classe.id, input.classeId)).limit(1);
      if (!classeRow) throw notFound("Classe introuvable.");
      const [existing] = await tx
        .select()
        .from(inscription)
        .where(and(eq(inscription.eleveId, id), eq(inscription.anneeScolaireId, classeRow.anneeScolaireId)))
        .limit(1)
        .for("update");
      if (existing) {
        if (existing.classeId !== classeRow.id) {
          const [{ total }] = await tx
            .select({ total: count() })
            .from(note)
            .innerJoin(evaluation, eq(note.evaluationId, evaluation.id))
            .where(and(eq(note.eleveId, id), eq(evaluation.classeId, existing.classeId)));
          if (total > 0) {
            throw new ApiError(409, "CONFLIT", "Impossible de déplacer un élève qui possède déjà des notes.");
          }
        }
        const [updated] = await tx
          .update(inscription)
          .set({ classeId: classeRow.id, statut: inscriptionStatut(statut) })
          .where(eq(inscription.id, existing.id))
          .returning();
        link = { ...updated, classeNom: classeRow.nom };
      } else {
        const [created] = await tx
          .insert(inscription)
          .values({
            eleveId: id,
            classeId: classeRow.id,
            anneeScolaireId: classeRow.anneeScolaireId,
            statut: inscriptionStatut(statut),
          })
          .returning();
        link = { ...created, classeNom: classeRow.nom };
      }
    } else {
      const [existing] = await tx
        .select({
          id: inscription.id,
          classeId: inscription.classeId,
          anneeScolaireId: inscription.anneeScolaireId,
          statut: inscription.statut,
          classeNom: classe.nom,
        })
        .from(inscription)
        .innerJoin(classe, eq(inscription.classeId, classe.id))
        .where(eq(inscription.eleveId, id))
        .limit(1);
      if (existing && input.statut) {
        const [updated] = await tx
          .update(inscription)
          .set({ statut: inscriptionStatut(statut) })
          .where(eq(inscription.id, existing.id))
          .returning();
        link = { ...updated, classeNom: existing.classeNom };
      } else {
        link = existing ?? null;
      }
    }

    return publicEleve(student, link);
  });
}

export async function deleteEleve(session: SessionUser, id: string) {
  if (!canWriteStudents(session.role)) throw forbidden();
  const db = getDb();
  const [current] = await db.select({ id: eleve.id }).from(eleve).where(eq(eleve.id, id)).limit(1);
  if (!current) throw notFound("Élève introuvable.");
  const [{ total }] = await db.select({ total: count() }).from(note).where(eq(note.eleveId, id));
  if (total > 0) {
    throw new ApiError(409, "CONFLIT", "Impossible de supprimer un élève qui possède des notes.");
  }
  await db.delete(eleve).where(eq(eleve.id, id));
}

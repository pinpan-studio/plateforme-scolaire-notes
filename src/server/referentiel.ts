import { randomBytes } from "node:crypto";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import {
  affectationEnseignant,
  anneeScolaire,
  classe,
  enseignant,
  etablissement,
  evaluation,
  matiere,
  niveau,
  periode,
  utilisateur,
} from "@/db/schema";
import {
  canReadAudit,
  canReadReferential,
  canWriteReferential,
  canWriteYear,
  type SessionUser,
} from "@/lib/auth/permissions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  assertPasswordChangeAllowed,
  assertSearchRate,
  assertTemporaryPasswordAllowed,
  recordPasswordChangeAttempt,
  recordPasswordChangeSuccess,
  recordTemporaryPasswordAttempt,
} from "@/lib/auth/rate-limit";
import { getDb } from "./db";
import { ApiError, forbidden, notFound } from "./errors";
import { optionalUuid, pagination, searchParams, searchQuery, versionOf } from "./query";
import {
  changementMotDePasseSchema,
  createAffectationSchema,
  createAnneeSchema,
  createEnseignantSchema,
  createMatiereSchema,
  createPeriodeSchema,
  createUtilisateurSchema,
  parseBody,
  patchAnneeSchema,
  patchEnseignantSchema,
  patchEtablissementSchema,
  patchMatiereSchema,
  patchPeriodeSchema,
  patchUtilisateurSchema,
} from "./schemas";
import { listAudit, writeAudit } from "./audit";
import { loadScope } from "./scope";

function assertReadReferential(session: SessionUser) {
  if (!canReadReferential(session.role)) throw forbidden();
}

function assertWriteReferential(session: SessionUser) {
  if (!canWriteReferential(session.role)) throw forbidden();
}

export async function getEtablissement(session: SessionUser) {
  assertReadReferential(session);
  const [row] = await getDb().select().from(etablissement).limit(1);
  if (!row) throw notFound("Établissement introuvable.");
  return row;
}

export async function updateEtablissement(session: SessionUser, body: unknown) {
  assertWriteReferential(session);
  const input = parseBody(patchEtablissementSchema, body);
  const db = getDb();
  const [current] = await db.select().from(etablissement).limit(1);
  if (!current) throw notFound("Établissement introuvable.");
  const [row] = await db
    .update(etablissement)
    .set({
      nom: input.nom ?? current.nom,
      adresse: input.adresse ?? current.adresse,
      telephone: input.telephone ?? current.telephone,
      email: input.email ?? current.email,
    })
    .where(eq(etablissement.id, current.id))
    .returning();
  return row;
}

export async function listAnnees(session: SessionUser) {
  if (!session.id) throw forbidden();
  return getDb().select().from(anneeScolaire).orderBy(asc(anneeScolaire.dateDebut));
}

export async function createAnnee(session: SessionUser, body: unknown) {
  if (!canWriteYear(session.role)) throw forbidden();
  const input = parseBody(createAnneeSchema, body);
  const [school] = await getDb().select({ id: etablissement.id }).from(etablissement).limit(1);
  if (!school) throw notFound("Établissement introuvable.");
  const [row] = await getDb()
    .insert(anneeScolaire)
    .values({
      etablissementId: school.id,
      libelle: input.libelle,
      dateDebut: input.dateDebut,
      dateFin: input.dateFin,
      statut: input.statut ?? "PREPARATION",
    })
    .returning();
  return row;
}

export async function updateAnnee(session: SessionUser, id: string, body: unknown) {
  if (!canWriteYear(session.role)) throw forbidden();
  const input = parseBody(patchAnneeSchema, body);
  const db = getDb();
  const [current] = await db.select().from(anneeScolaire).where(eq(anneeScolaire.id, id)).limit(1);
  if (!current) throw notFound("Année introuvable.");
  if (input.dateDebut && input.dateFin && input.dateFin <= input.dateDebut) {
    throw new ApiError(422, "VALIDATION", "La fin est postérieure au début.", [
      { path: "dateFin", message: "La fin est postérieure au début." },
    ]);
  }
  const [row] = await db
    .update(anneeScolaire)
    .set({
      libelle: input.libelle ?? current.libelle,
      dateDebut: input.dateDebut ?? current.dateDebut,
      dateFin: input.dateFin ?? current.dateFin,
      statut: input.statut ?? current.statut,
    })
    .where(eq(anneeScolaire.id, id))
    .returning();
  return row;
}

export async function listPeriodes(session: SessionUser, request: Request) {
  if (!session.id) throw forbidden();
  const anneeScolaireId = optionalUuid(searchParams(request), "anneeScolaireId");
  const filters = anneeScolaireId ? eq(periode.anneeScolaireId, anneeScolaireId) : undefined;
  return getDb().select().from(periode).where(filters).orderBy(asc(periode.ordre));
}

export async function createPeriode(session: SessionUser, body: unknown) {
  if (!canWriteYear(session.role)) throw forbidden();
  const input = parseBody(createPeriodeSchema, body);
  const [row] = await getDb().insert(periode).values(input).returning();
  return row;
}

export async function updatePeriode(session: SessionUser, id: string, body: unknown) {
  if (!canWriteYear(session.role)) throw forbidden();
  const input = parseBody(patchPeriodeSchema, body);
  const db = getDb();
  const [current] = await db.select().from(periode).where(eq(periode.id, id)).limit(1);
  if (!current) throw notFound("Période introuvable.");
  const [row] = await db
    .update(periode)
    .set({
      libelle: input.libelle ?? current.libelle,
      ordre: input.ordre ?? current.ordre,
      dateDebut: input.dateDebut ?? current.dateDebut,
      dateFin: input.dateFin ?? current.dateFin,
    })
    .where(eq(periode.id, id))
    .returning();
  return row;
}

export async function deletePeriode(session: SessionUser, id: string) {
  if (!canWriteYear(session.role)) throw forbidden();
  const db = getDb();
  const [{ total }] = await db.select({ total: count() }).from(evaluation).where(eq(evaluation.periodeId, id));
  if (total > 0) throw new ApiError(409, "CONFLIT", "Cette période est utilisée par des évaluations.");
  const deleted = await db.delete(periode).where(eq(periode.id, id)).returning({ id: periode.id });
  if (deleted.length === 0) throw notFound("Période introuvable.");
}

export async function listNiveaux(session: SessionUser) {
  if (!session.id) throw forbidden();
  return getDb().select().from(niveau).orderBy(asc(niveau.ordre));
}

export async function listMatieres(session: SessionUser, request?: Request) {
  const scope = await loadScope(session);
  const params = request ? searchParams(request) : new URLSearchParams();
  const q = request ? searchQuery(params) : undefined;
  const niveauId = request ? optionalUuid(params, "niveauId") : undefined;
  let rows = await getDb().select().from(matiere).orderBy(asc(matiere.nom));
  if (niveauId) rows = rows.filter((row) => row.niveauId === niveauId);
  if (q) {
    assertSearchRate(session.id);
    const needle = q.toLocaleLowerCase("fr");
    rows = rows.filter(
      (row) => row.nom.toLocaleLowerCase("fr").includes(needle) || row.code.toLocaleLowerCase("fr").includes(needle),
    );
  }
  if (canReadReferential(session.role) || session.role === "CONSULTATION") return rows;
  const ids = new Set(scope.affectations.map((row) => row.matiereId));
  if (session.role === "PROFESSEUR_PRINCIPAL" && scope.classesPp.length > 0) {
    const links = await getDb()
      .select({ matiereId: affectationEnseignant.matiereId })
      .from(affectationEnseignant)
      .where(inArray(affectationEnseignant.classeId, scope.classesPp));
    for (const link of links) ids.add(link.matiereId);
  }
  return rows.filter((row) => ids.has(row.id));
}

export async function createMatiere(session: SessionUser, body: unknown) {
  assertWriteReferential(session);
  const input = parseBody(createMatiereSchema, body);
  const [row] = await getDb()
    .insert(matiere)
    .values({
      code: input.code,
      nom: input.nom,
      coefficient: input.coefficient,
      niveauId: input.niveauId ?? null,
    })
    .returning();
  return row;
}

export async function updateMatiere(session: SessionUser, id: string, body: unknown) {
  assertWriteReferential(session);
  const input = parseBody(patchMatiereSchema, body);
  const db = getDb();
  const [current] = await db.select().from(matiere).where(eq(matiere.id, id)).limit(1);
  if (!current) throw notFound("Matière introuvable.");
  const [row] = await db
    .update(matiere)
    .set({
      code: input.code ?? current.code,
      nom: input.nom ?? current.nom,
      coefficient: input.coefficient ?? current.coefficient,
      niveauId: input.niveauId === undefined ? current.niveauId : input.niveauId,
    })
    .where(eq(matiere.id, id))
    .returning();
  return row;
}

export async function deleteMatiere(session: SessionUser, id: string) {
  assertWriteReferential(session);
  const db = getDb();
  const [{ evals }] = await db.select({ evals: count() }).from(evaluation).where(eq(evaluation.matiereId, id));
  const [{ affectations }] = await db
    .select({ affectations: count() })
    .from(affectationEnseignant)
    .where(eq(affectationEnseignant.matiereId, id));
  if (evals > 0 || affectations > 0) {
    throw new ApiError(409, "CONFLIT", "Impossible de supprimer une matière utilisée par une évaluation ou une affectation.");
  }
  const deleted = await db.delete(matiere).where(eq(matiere.id, id)).returning({ id: matiere.id });
  if (deleted.length === 0) throw notFound("Matière introuvable.");
}

function publicEnseignant(row: typeof enseignant.$inferSelect) {
  return { ...row, version: versionOf(row.updatedAt) };
}

export async function listEnseignants(session: SessionUser, request: Request) {
  assertReadReferential(session);
  const page = pagination(searchParams(request));
  const db = getDb();
  const [{ total }] = await db.select({ total: count() }).from(enseignant);
  const rows = await db
    .select()
    .from(enseignant)
    .orderBy(asc(enseignant.nom), asc(enseignant.prenom))
    .limit(page.pageSize)
    .offset(page.offset);
  return { data: rows.map(publicEnseignant), page: page.page, pageSize: page.pageSize, total };
}

export async function createEnseignant(session: SessionUser, body: unknown) {
  assertWriteReferential(session);
  const input = parseBody(createEnseignantSchema, body);
  const [row] = await getDb()
    .insert(enseignant)
    .values({
      nom: input.nom,
      prenom: input.prenom,
      email: input.email,
      telephone: input.telephone ?? null,
      statut: input.statut ?? "ACTIF",
    })
    .returning();
  return publicEnseignant(row);
}

export async function updateEnseignant(session: SessionUser, id: string, body: unknown) {
  assertWriteReferential(session);
  const input = parseBody(patchEnseignantSchema, body);
  const db = getDb();
  const [current] = await db.select().from(enseignant).where(eq(enseignant.id, id)).limit(1);
  if (!current) throw notFound("Enseignant introuvable.");
  const [row] = await db
    .update(enseignant)
    .set({
      nom: input.nom ?? current.nom,
      prenom: input.prenom ?? current.prenom,
      email: input.email ?? current.email,
      telephone: input.telephone === undefined ? current.telephone : input.telephone,
      statut: input.statut ?? current.statut,
    })
    .where(eq(enseignant.id, id))
    .returning();
  return publicEnseignant(row);
}

export async function deleteEnseignant(session: SessionUser, id: string) {
  assertWriteReferential(session);
  const db = getDb();
  const [{ evals }] = await db.select({ evals: count() }).from(evaluation).where(eq(evaluation.enseignantId, id));
  const [{ affectations }] = await db
    .select({ affectations: count() })
    .from(affectationEnseignant)
    .where(eq(affectationEnseignant.enseignantId, id));
  const [{ classes }] = await db.select({ classes: count() }).from(classe).where(eq(classe.professeurPrincipalId, id));
  const [{ comptes }] = await db.select({ comptes: count() }).from(utilisateur).where(eq(utilisateur.enseignantId, id));
  if (evals > 0 || affectations > 0 || classes > 0 || comptes > 0) {
    throw new ApiError(409, "CONFLIT", "Impossible de supprimer un enseignant encore lié à des données.");
  }
  const deleted = await db.delete(enseignant).where(eq(enseignant.id, id)).returning({ id: enseignant.id });
  if (deleted.length === 0) throw notFound("Enseignant introuvable.");
}

export async function listAffectations(session: SessionUser, request: Request) {
  const scope = await loadScope(session);
  const params = searchParams(request);
  const classeId = optionalUuid(params, "classeId");
  const enseignantId = optionalUuid(params, "enseignantId");
  const matiereId = optionalUuid(params, "matiereId");
  const anneeScolaireId = optionalUuid(params, "anneeScolaireId");
  const rows = await getDb()
    .select({
      affectation: affectationEnseignant,
      enseignantNom: enseignant.nom,
      enseignantPrenom: enseignant.prenom,
      classeNom: classe.nom,
      matiereNom: matiere.nom,
      anneeLibelle: anneeScolaire.libelle,
    })
    .from(affectationEnseignant)
    .innerJoin(enseignant, eq(affectationEnseignant.enseignantId, enseignant.id))
    .innerJoin(classe, eq(affectationEnseignant.classeId, classe.id))
    .innerJoin(matiere, eq(affectationEnseignant.matiereId, matiere.id))
    .innerJoin(anneeScolaire, eq(affectationEnseignant.anneeScolaireId, anneeScolaire.id))
    .orderBy(asc(affectationEnseignant.createdAt));
  return rows
    .filter((row) => {
      const item = row.affectation;
      if (classeId && item.classeId !== classeId) return false;
      if (enseignantId && item.enseignantId !== enseignantId) return false;
      if (matiereId && item.matiereId !== matiereId) return false;
      if (anneeScolaireId && item.anneeScolaireId !== anneeScolaireId) return false;
      if (canReadReferential(session.role) || session.role === "CONSULTATION") return true;
      if (scope.classesPp.includes(item.classeId)) return true;
      return scope.affectations.some((link) => link.classeId === item.classeId && link.matiereId === item.matiereId);
    })
    .map((row) => ({
      ...row.affectation,
      enseignant: `${row.enseignantPrenom} ${row.enseignantNom}`,
      classe: row.classeNom,
      matiere: row.matiereNom,
      annee: row.anneeLibelle,
    }));
}

export async function createAffectation(session: SessionUser, body: unknown) {
  assertWriteReferential(session);
  const input = parseBody(createAffectationSchema, body);
  const [classeRow] = await getDb().select().from(classe).where(eq(classe.id, input.classeId)).limit(1);
  if (!classeRow) throw notFound("Classe introuvable.");
  const [row] = await getDb()
    .insert(affectationEnseignant)
    .values({
      enseignantId: input.enseignantId,
      classeId: input.classeId,
      matiereId: input.matiereId,
      anneeScolaireId: classeRow.anneeScolaireId,
    })
    .returning();
  return row;
}

export async function deleteAffectation(session: SessionUser, id: string) {
  assertWriteReferential(session);
  const db = getDb();
  const [row] = await db.select().from(affectationEnseignant).where(eq(affectationEnseignant.id, id)).limit(1);
  if (!row) throw notFound("Affectation introuvable.");
  const [{ total }] = await db
    .select({ total: count() })
    .from(evaluation)
    .where(
      and(
        eq(evaluation.classeId, row.classeId),
        eq(evaluation.matiereId, row.matiereId),
        eq(evaluation.enseignantId, row.enseignantId),
      ),
    );
  if (total > 0) {
    throw new ApiError(409, "CONFLIT", "Retirez les évaluations de cette affectation avant de la supprimer.");
  }
  await db.delete(affectationEnseignant).where(eq(affectationEnseignant.id, id));
}

function publicUtilisateur(row: {
  id: string;
  email: string;
  roleCode: string;
  enseignantId: string | null;
  prenom: string;
  nom: string;
  actif: boolean;
}) {
  return {
    id: row.id,
    email: row.email,
    role: row.roleCode,
    enseignantId: row.enseignantId,
    prenom: row.prenom,
    nom: row.nom,
    actif: row.actif,
  };
}

export async function listUtilisateurs(session: SessionUser) {
  assertWriteReferential(session);
  const rows = await getDb()
    .select({
      id: utilisateur.id,
      email: utilisateur.email,
      roleCode: utilisateur.roleCode,
      enseignantId: utilisateur.enseignantId,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      actif: utilisateur.actif,
    })
    .from(utilisateur)
    .orderBy(asc(utilisateur.nom));
  return rows.map(publicUtilisateur);
}

export async function createUtilisateur(session: SessionUser, body: unknown) {
  assertWriteReferential(session);
  const input = parseBody(createUtilisateurSchema, body);
  const motDePasseHash = await hashPassword(input.motDePasse);
  const [row] = await getDb()
    .insert(utilisateur)
    .values({
      email: input.email,
      motDePasseHash,
      roleCode: input.roleCode,
      enseignantId: input.enseignantId ?? null,
      prenom: input.prenom,
      nom: input.nom,
      actif: true,
    })
    .returning({
      id: utilisateur.id,
      email: utilisateur.email,
      roleCode: utilisateur.roleCode,
      enseignantId: utilisateur.enseignantId,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      actif: utilisateur.actif,
    });
  return publicUtilisateur(row);
}

export async function updateUtilisateur(session: SessionUser, id: string, body: unknown, ip: string) {
  assertWriteReferential(session);
  const input = parseBody(patchUtilisateurSchema, body);
  if (input.motDePasse) await assertPasswordChangeAllowed(session.id, ip);
  const db = getDb();
  const [current] = await db.select().from(utilisateur).where(eq(utilisateur.id, id)).limit(1);
  if (!current) {
    if (input.motDePasse) await recordPasswordChangeAttempt(session.id, ip);
    throw notFound("Utilisateur introuvable.");
  }
  let motDePasseHash = current.motDePasseHash;
  if (input.motDePasse) {
    if (!input.motDePasseActuel) {
      await recordPasswordChangeAttempt(session.id, ip);
      throw new ApiError(403, "FORBIDDEN", "Le mot de passe actuel est requis.");
    }
    const ok = await verifyPassword(input.motDePasseActuel, current.motDePasseHash);
    if (!ok) {
      await recordPasswordChangeAttempt(session.id, ip);
      throw new ApiError(403, "FORBIDDEN", "Le mot de passe actuel est requis.");
    }
    motDePasseHash = await hashPassword(input.motDePasse);
  }
  const [row] = await db
    .update(utilisateur)
    .set({
      email: input.email ?? current.email,
      prenom: input.prenom ?? current.prenom,
      nom: input.nom ?? current.nom,
      actif: input.actif ?? current.actif,
      roleCode: input.roleCode ?? current.roleCode,
      enseignantId: input.enseignantId === undefined ? current.enseignantId : input.enseignantId,
      motDePasseHash,
      ...(input.motDePasse ? { sessionVersion: sql`${utilisateur.sessionVersion} + 1` } : {}),
    })
    .where(eq(utilisateur.id, id))
    .returning({
      id: utilisateur.id,
      email: utilisateur.email,
      roleCode: utilisateur.roleCode,
      enseignantId: utilisateur.enseignantId,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      actif: utilisateur.actif,
    });
  if (input.motDePasse) await recordPasswordChangeSuccess(session.id);
  return publicUtilisateur(row);
}

export async function changerMotDePasse(session: SessionUser, body: unknown, ip: string) {
  const input = parseBody(changementMotDePasseSchema, body);
  await assertPasswordChangeAllowed(session.id, ip);
  const db = getDb();
  const [current] = await db.select().from(utilisateur).where(eq(utilisateur.id, session.id)).limit(1);
  if (!current || !current.actif) throw forbidden("Compte indisponible.");
  const ok = await verifyPassword(input.motDePasseActuel, current.motDePasseHash);
  if (!ok) {
    await recordPasswordChangeAttempt(session.id, ip);
    throw new ApiError(403, "FORBIDDEN", "Le mot de passe actuel est requis.");
  }
  await db
    .update(utilisateur)
    .set({ motDePasseHash: await hashPassword(input.motDePasse), sessionVersion: sql`${utilisateur.sessionVersion} + 1` })
    .where(eq(utilisateur.id, current.id));
  await recordPasswordChangeSuccess(session.id);
  await writeAudit({
    type: "MOT_DE_PASSE",
    acteurId: session.id,
    identifiant: session.email,
    resultat: "200",
    action: "PATCH",
    cibleType: "utilisateur",
    cibleId: current.id,
  });
}

export async function definirMotDePasseTemporaire(session: SessionUser, id: string, ip: string) {
  assertWriteReferential(session);
  await assertTemporaryPasswordAllowed(session.id, ip);
  const db = getDb();
  const [current] = await db.select().from(utilisateur).where(eq(utilisateur.id, id)).limit(1);
  if (!current) {
    await recordTemporaryPasswordAttempt(session.id, ip);
    throw notFound("Utilisateur introuvable.");
  }
  const motDePasseTemporaire = `Tmp-${randomBytes(9).toString("base64url")}`;
  await db
    .update(utilisateur)
    .set({
      motDePasseHash: await hashPassword(motDePasseTemporaire),
      sessionVersion: sql`${utilisateur.sessionVersion} + 1`,
    })
    .where(eq(utilisateur.id, id));
  await recordTemporaryPasswordAttempt(session.id, ip);
  await writeAudit({
    type: "MOT_DE_PASSE",
    acteurId: session.id,
    identifiant: session.email,
    resultat: "200",
    action: "POST",
    cibleType: "utilisateur",
    cibleId: id,
  });
  return { motDePasseTemporaire };
}

export async function readAudit(session: SessionUser) {
  if (!canReadAudit(session.role)) throw forbidden();
  const rows = await listAudit(100);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

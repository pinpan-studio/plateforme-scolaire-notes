import { eq } from "drizzle-orm";
import { affectationEnseignant, anneeScolaire, classe } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/permissions";
import { canReadAllResults } from "@/lib/auth/permissions";
import { getDb } from "./db";
import { ApiError, forbidden } from "./errors";
import { writeAudit } from "./audit";

export type AffectationScope = {
  classeId: string;
  matiereId: string;
  anneeScolaireId: string;
};

export type Scope = SessionUser & {
  classesPp: string[];
  affectations: AffectationScope[];
};

export async function loadScope(session: SessionUser): Promise<Scope> {
  if (!session.enseignantId) {
    return { ...session, classesPp: [], affectations: [] };
  }
  const db = getDb();
  const [pp, affectations] = await Promise.all([
    db
      .select({ id: classe.id })
      .from(classe)
      .where(eq(classe.professeurPrincipalId, session.enseignantId)),
    db
      .select({
        classeId: affectationEnseignant.classeId,
        matiereId: affectationEnseignant.matiereId,
        anneeScolaireId: affectationEnseignant.anneeScolaireId,
      })
      .from(affectationEnseignant)
      .where(eq(affectationEnseignant.enseignantId, session.enseignantId)),
  ]);
  return {
    ...session,
    classesPp: pp.map((row) => row.id),
    affectations,
  };
}

export function readsEverything(scope: Scope): boolean {
  return canReadAllResults(scope.role);
}

export function classIdsInScope(scope: Scope): string[] | null {
  if (readsEverything(scope)) return null;
  return [...new Set([...scope.classesPp, ...scope.affectations.map((row) => row.classeId)])];
}

export function canReadClass(scope: Scope, classeId: string): boolean {
  if (readsEverything(scope)) return true;
  if (scope.classesPp.includes(classeId)) return true;
  return scope.affectations.some((row) => row.classeId === classeId);
}

export function canReadClassSubject(scope: Scope, classeId: string, matiereId: string): boolean {
  if (readsEverything(scope)) return true;
  if (scope.role === "PROFESSEUR_PRINCIPAL" && scope.classesPp.includes(classeId)) return true;
  return scope.affectations.some((row) => row.classeId === classeId && row.matiereId === matiereId);
}

export function canWriteClassSubject(scope: Scope, classeId: string, matiereId: string, yearClosed: boolean): boolean {
  if (scope.role === "ADMIN") return true;
  if (yearClosed) return false;
  if (scope.role !== "ENSEIGNANT" && scope.role !== "PROFESSEUR_PRINCIPAL") return false;
  return scope.affectations.some((row) => row.classeId === classeId && row.matiereId === matiereId);
}

export function subjectIdsForClass(scope: Scope, classeId: string): string[] | null {
  if (readsEverything(scope)) return null;
  if (scope.role === "PROFESSEUR_PRINCIPAL" && scope.classesPp.includes(classeId)) return null;
  return scope.affectations.filter((row) => row.classeId === classeId).map((row) => row.matiereId);
}

export async function yearOfClass(classeId: string) {
  const [row] = await getDb()
    .select({
      anneeScolaireId: classe.anneeScolaireId,
      statut: anneeScolaire.statut,
      classeNom: classe.nom,
    })
    .from(classe)
    .innerJoin(anneeScolaire, eq(classe.anneeScolaireId, anneeScolaire.id))
    .where(eq(classe.id, classeId))
    .limit(1);
  return row ?? null;
}

export async function refuse(
  session: SessionUser,
  action: string,
  cibleType: string,
  cibleId: string | null,
  message = "Action interdite pour ce rôle.",
): Promise<never> {
  await writeAudit({
    type: "AUTORISATION_REFUSEE",
    acteurId: session.id,
    identifiant: session.email,
    resultat: "403",
    action,
    cibleType,
    cibleId,
  });
  throw forbidden(message);
}

export function closedYearError(): ApiError {
  return new ApiError(403, "ANNEE_CLOTUREE", "L'année est clôturée. Seul un administrateur peut corriger.");
}

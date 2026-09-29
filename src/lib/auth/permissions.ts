export const ROLES = ["ADMIN", "DIRECTION", "ENSEIGNANT", "PROFESSEUR_PRINCIPAL", "CONSULTATION"] as const;

export type Role = (typeof ROLES)[number];

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  enseignantId: string | null;
  prenom: string;
  nom: string;
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Référentiel : établissement, matières, comptes, enseignants, affectations. */
export function canWriteReferential(role: Role): boolean {
  return role === "ADMIN";
}

export function canReadReferential(role: Role): boolean {
  return role === "ADMIN" || role === "DIRECTION";
}

/** Ouverture et clôture d'année, périodes. */
export function canWriteYear(role: Role): boolean {
  return role === "ADMIN" || role === "DIRECTION";
}

/** Inscriptions et fiches élèves. */
export function canWriteStudents(role: Role): boolean {
  return role === "ADMIN";
}

export function canWriteGrades(role: Role): boolean {
  return role === "ADMIN" || role === "ENSEIGNANT" || role === "PROFESSEUR_PRINCIPAL";
}

export function canReadAllResults(role: Role): boolean {
  return role === "ADMIN" || role === "DIRECTION" || role === "CONSULTATION";
}

export function canReadEstablishmentDashboard(role: Role): boolean {
  return role === "ADMIN" || role === "DIRECTION" || role === "CONSULTATION";
}

export function canReadAudit(role: Role): boolean {
  return role === "ADMIN";
}

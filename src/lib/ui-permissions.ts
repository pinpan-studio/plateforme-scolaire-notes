import type { Role } from "@/lib/api-client/types";

/**
 * Visibilité des actions dans l'interface.
 * L'API reste souveraine : un bouton affiché peut encore recevoir un 403.
 * Aligné sur docs/ux/ux-ui-spec.md (la direction tient la structure pédagogique,
 * pas les comptes, pas l'établissement, pas les notes).
 */

const TOUS: Role[] = ["ADMIN", "DIRECTION", "ENSEIGNANT", "PROFESSEUR_PRINCIPAL", "CONSULTATION"];

export type RessourceUi =
  | "annee"
  | "classe"
  | "eleve"
  | "enseignant"
  | "matiere"
  | "affectation"
  | "periode"
  | "etablissement"
  | "evaluation"
  | "note"
  | "utilisateur"
  | "appreciation";

const ECRITURE: Record<RessourceUi, Role[]> = {
  annee: ["ADMIN", "DIRECTION"],
  classe: ["ADMIN", "DIRECTION"],
  eleve: ["ADMIN", "DIRECTION"],
  enseignant: ["ADMIN", "DIRECTION"],
  matiere: ["ADMIN", "DIRECTION"],
  affectation: ["ADMIN", "DIRECTION"],
  periode: ["ADMIN", "DIRECTION"],
  etablissement: ["ADMIN"],
  evaluation: ["ADMIN", "ENSEIGNANT", "PROFESSEUR_PRINCIPAL"],
  note: ["ADMIN", "ENSEIGNANT", "PROFESSEUR_PRINCIPAL"],
  utilisateur: ["ADMIN"],
  appreciation: ["ADMIN", "PROFESSEUR_PRINCIPAL"],
};

export function rolesConnus(): Role[] {
  return TOUS;
}

export function peutEcrire(role: Role, ressource: RessourceUi): boolean {
  return ECRITURE[ressource].includes(role);
}

export function estLectureSeule(role: Role): boolean {
  return role === "CONSULTATION" || role === "DIRECTION";
}

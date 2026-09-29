import type { Role } from "@/lib/api-client/types";

export type LienNav = {
  href: string;
  label: string;
  roles: Role[];
};

export type GroupeNav = {
  label: string;
  liens: LienNav[];
};

const TOUS: Role[] = ["ADMIN", "DIRECTION", "ENSEIGNANT", "PROFESSEUR_PRINCIPAL", "CONSULTATION"];
const STRUCTURE: Role[] = ["ADMIN", "DIRECTION"];
const SAISIE: Role[] = ["ADMIN", "ENSEIGNANT", "PROFESSEUR_PRINCIPAL"];
const SYNTHESE: Role[] = ["ADMIN", "DIRECTION", "PROFESSEUR_PRINCIPAL", "CONSULTATION"];

export const GROUPES_NAV: GroupeNav[] = [
  {
    label: "Scolarité",
    liens: [
      { href: "/annees", label: "Années scolaires", roles: STRUCTURE },
      { href: "/classes", label: "Classes", roles: TOUS },
      { href: "/eleves", label: "Élèves", roles: TOUS },
      { href: "/enseignants", label: "Enseignants", roles: STRUCTURE },
      { href: "/matieres", label: "Matières", roles: TOUS },
    ],
  },
  {
    label: "Organisation",
    liens: [
      { href: "/affectations", label: "Affectations", roles: STRUCTURE },
      { href: "/periodes", label: "Périodes", roles: TOUS },
      { href: "/etablissement", label: "Établissement", roles: ["ADMIN"] },
    ],
  },
  {
    label: "Notes",
    liens: [
      { href: "/evaluations", label: "Évaluations", roles: TOUS },
      { href: "/evaluations?vue=saisie", label: "Saisie des notes", roles: SAISIE },
      { href: "/synthese", label: "Synthèse de classe", roles: SYNTHESE },
    ],
  },
  {
    label: "Résultats",
    liens: [
      { href: "/resultats", label: "Résultats", roles: TOUS },
      { href: "/bulletins", label: "Bulletins", roles: TOUS },
      { href: "/analyses", label: "Analyses", roles: TOUS },
    ],
  },
  {
    label: "Compte",
    liens: [
      { href: "/profil", label: "Mon profil", roles: TOUS },
      { href: "/utilisateurs", label: "Utilisateurs", roles: ["ADMIN"] },
    ],
  },
];

export const LIEN_TABLEAU: LienNav = {
  href: "/",
  label: "Tableau de bord",
  roles: TOUS,
};

export function groupesPourRole(role: Role): GroupeNav[] {
  return GROUPES_NAV.map((groupe) => ({
    ...groupe,
    liens: groupe.liens.filter((lien) => lien.roles.includes(role)),
  })).filter((groupe) => groupe.liens.length > 0);
}

export function liensPourRole(role: Role): LienNav[] {
  return [LIEN_TABLEAU, ...groupesPourRole(role).flatMap((groupe) => groupe.liens)];
}

export function libelleRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "Administration";
    case "DIRECTION":
      return "Direction";
    case "ENSEIGNANT":
      return "Enseignant";
    case "PROFESSEUR_PRINCIPAL":
      return "Professeur principal";
    case "CONSULTATION":
      return "Consultation";
  }
}

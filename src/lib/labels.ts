import type { StatutAnnee, StatutInscription, TypeEvaluation } from "@/lib/api-client/types";

export function libelleAnnee(statut: StatutAnnee): string {
  switch (statut) {
    case "PREPARATION":
      return "Brouillon";
    case "EN_COURS":
      return "Active";
    case "CLOTUREE":
      return "Clôturée";
  }
}

export function libelleInscription(statut: StatutInscription): string {
  switch (statut) {
    case "INSCRIT":
      return "Inscrit";
    case "SORTI":
      return "Sorti";
    case "TRANSFERE":
      return "Transféré";
  }
}

export function libelleTypeEvaluation(type: TypeEvaluation): string {
  switch (type) {
    case "DEVOIR":
      return "Devoir";
    case "INTERROGATION":
      return "Contrôle";
    case "COMPOSITION":
      return "Composition";
  }
}

export function libelleSexe(sexe: "F" | "M"): string {
  return sexe === "F" ? "Féminin" : "Masculin";
}

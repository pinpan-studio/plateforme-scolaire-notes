import type { Periode } from "@/lib/api-client/types";

/** Période qui contient la date du jour, sinon celle d'ordre le plus élevé. */
export function periodeCourante(periodes: Periode[], aujourdhui = new Date()): Periode | null {
  if (periodes.length === 0) {
    return null;
  }
  const iso = aujourdhui.toISOString().slice(0, 10);
  const enCours = periodes.find((periode) => periode.dateDebut <= iso && iso <= periode.dateFin);
  if (enCours) {
    return enCours;
  }
  return [...periodes].sort((a, b) => b.ordre - a.ordre)[0] ?? null;
}

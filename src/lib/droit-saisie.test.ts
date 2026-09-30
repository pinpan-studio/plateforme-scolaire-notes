import { describe, expect, it } from "vitest";
import { droitSaisie, estAffecte, type AffectationSaisie } from "@/lib/droit-saisie";

const mienne: AffectationSaisie = {
  enseignantId: "moi",
  classeId: "classe",
  matiereId: "maths",
  anneeScolaireId: "annee",
};

describe("affectation de saisie", () => {
  it("reconnaît seulement l'affectation de l'enseignant connecté", () => {
    const collegue: AffectationSaisie = { ...mienne, enseignantId: "collegue" };
    const critere = {
      enseignantId: "moi",
      classeId: "classe",
      matiereId: "maths",
      anneeScolaireId: "annee",
    };
    expect(estAffecte([collegue], critere)).toBe(false);
    expect(estAffecte([{ ...mienne, matiereId: "francais" }], critere)).toBe(false);
    expect(estAffecte([collegue, mienne], critere)).toBe(true);
    expect(estAffecte([mienne], { ...critere, enseignantId: null })).toBe(false);
  });

  it("verrouille la consultation, la direction, l'année close et le hors affectation", () => {
    expect(droitSaisie({ role: "CONSULTATION", anneeCloturee: false, affecte: false }).peutModifier).toBe(false);
    expect(droitSaisie({ role: "DIRECTION", anneeCloturee: false, affecte: true })).toMatchObject({
      peutModifier: false,
      motifLectureSeule: "Consultation seule. Vous pouvez lire les notes, pas les modifier.",
    });
    expect(droitSaisie({ role: "ENSEIGNANT", anneeCloturee: true, affecte: true }).motifLectureSeule).toBe(
      "Année clôturée. Les notes ne sont plus modifiables.",
    );
    expect(droitSaisie({ role: "PROFESSEUR_PRINCIPAL", anneeCloturee: false, affecte: false })).toMatchObject({
      peutModifier: false,
      motifLectureSeule: "Hors de votre affectation. Vous pouvez consulter ces notes, pas les modifier.",
    });
  });

  it("laisse saisir l'administrateur et l'enseignant affecté", () => {
    expect(droitSaisie({ role: "ADMIN", anneeCloturee: true, affecte: false })).toEqual({
      peutModifier: true,
      motifLectureSeule: null,
    });
    expect(droitSaisie({ role: "ENSEIGNANT", anneeCloturee: false, affecte: true })).toEqual({
      peutModifier: true,
      motifLectureSeule: null,
    });
    expect(droitSaisie({ role: "PROFESSEUR_PRINCIPAL", anneeCloturee: false, affecte: true }).peutModifier).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client/http";
import { preparerEnregistrement, TAILLE_LOT_NOTES } from "@/lib/api-client/enregistrement-notes";
import type { LigneNoteEnvoi } from "@/lib/api-client/types";

function ligne(partiel: Partial<LigneNoteEnvoi> & Pick<LigneNoteEnvoi, "eleveId">): LigneNoteEnvoi {
  return {
    eleveId: partiel.eleveId,
    valeur: partiel.valeur ?? null,
    absent: partiel.absent ?? false,
    commentaire: partiel.commentaire ?? null,
    supprimer: partiel.supprimer ?? false,
    version: partiel.version ?? null,
    noteId: partiel.noteId ?? null,
  };
}

describe("préparation de l'enregistrement", () => {
  it("met la version lue dans chaque suppression et ne relit rien", () => {
    const plan = preparerEnregistrement([
      ligne({
        eleveId: "eleve-1",
        supprimer: true,
        noteId: "note-1",
        version: "2026-09-30T09:16:00.123Z",
      }),
      ligne({ eleveId: "eleve-2", supprimer: true, noteId: null, version: null }),
      ligne({ eleveId: "eleve-3", valeur: 14, version: "2026-09-30T09:16:00.456Z", noteId: "note-3" }),
    ]);
    expect(plan.suppressions).toEqual([
      { eleveId: "eleve-1", noteId: "note-1", version: "2026-09-30T09:16:00.123Z" },
    ]);
    expect(plan.lot).toEqual([
      {
        eleveId: "eleve-3",
        valeur: 14,
        estAbsent: false,
        commentaire: null,
        version: "2026-09-30T09:16:00.456Z",
      },
    ]);
  });

  it("refuse une suppression sans version avant tout envoi", () => {
    expect(() =>
      preparerEnregistrement([
        ligne({ eleveId: "eleve-1", supprimer: true, noteId: "note-1", version: null }),
      ]),
    ).toThrow(ApiError);
    try {
      preparerEnregistrement([
        ligne({ eleveId: "eleve-1", supprimer: true, noteId: "note-1", version: null }),
      ]);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      if (error instanceof ApiError) {
        expect(error.status).toBe(422);
        expect(error.champs.some((champ) => champ.champ === "version")).toBe(true);
        expect(error.message).toContain("La suppression n'a pas été envoyée");
        expect(error.message).toContain("Vos saisies sont encore sur cette page");
      }
    }
  });

  it("refuse un lot de plus de 100 lignes sans le découper", () => {
    const lignes = Array.from({ length: TAILLE_LOT_NOTES + 1 }, (_, index) =>
      ligne({ eleveId: `eleve-${index}`, valeur: 10, version: null }),
    );
    expect(() => preparerEnregistrement(lignes)).toThrow(ApiError);
    try {
      preparerEnregistrement(lignes);
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      if (error instanceof ApiError) {
        expect(error.message).toContain("Rien n'a été envoyé");
        expect(error.message).toContain("100");
        expect(error.champs[0]?.message).toBe("Lot trop volumineux.");
      }
    }
  });

  it("accepte exactement 100 lignes à écrire", () => {
    const lignes = Array.from({ length: TAILLE_LOT_NOTES }, (_, index) =>
      ligne({ eleveId: `eleve-${index}`, valeur: 10, version: "2026-09-30T09:16:00.123Z", noteId: `note-${index}` }),
    );
    expect(preparerEnregistrement(lignes).lot).toHaveLength(100);
  });
});

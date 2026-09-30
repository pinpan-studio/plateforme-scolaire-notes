import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api-client";
import {
  agregerMoyennesMatieres,
  moyenneDepuisAnalyseMatiere,
  moyennesElevesDepuisClasse,
} from "@/lib/api-client/analyses";
import type { ClasseResume } from "@/lib/api-client/types";

const classe: ClasseResume = {
  id: "classe-6a",
  nom: "6e A",
  niveau: "6e",
  niveauId: "niv",
  effectif: 2,
  professeurPrincipal: null,
  professeurPrincipalId: null,
  annee: "2025-2026",
  anneeScolaireId: "annee",
};

describe("moyennes de matière publiées", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lit la moyenne de classe publiée par l'analyse de matière", () => {
    const ligne = moyenneDepuisAnalyseMatiere(
      {
        matiere: { matiereId: "math", nom: "Mathématiques", code: "MATH", coefficient: 4 },
        statistiques: { moyenneClasse: 11.12, calculables: 14, effectif: 14 },
      },
      { id: "repli", nom: "repli" },
    );
    expect(ligne).toEqual({
      matiereId: "math",
      nom: "Mathématiques",
      moyenne: 11.12,
      effectif: 14,
    });
  });

  it("agrège les moyennes d'élèves déjà publiées, y compris sur plusieurs classes", () => {
    const lignes = moyennesElevesDepuisClasse({
      eleves: [
        {
          eleveId: "e1",
          matieres: [
            { matiereId: "math", nom: "Mathématiques", moyenne: 10 },
            { matiereId: "fr", nom: "Français", moyenne: null },
          ],
        },
        {
          eleveId: "e2",
          matieres: [
            { matiereId: "math", nom: "Mathématiques", moyenne: 12 },
            { matiereId: "fr", nom: "Français", moyenne: 14 },
          ],
        },
      ],
    });
    lignes.push({ matiereId: "math", nom: "Mathématiques", moyenne: 14 });
    expect(agregerMoyennesMatieres(lignes)).toEqual({
      matieres: [
        { matiereId: "fr", nom: "Français", moyenne: 14, effectif: 1 },
        { matiereId: "math", nom: "Mathématiques", moyenne: 12, effectif: 3 },
      ],
    });
  });

  it("sans classe, interroge chaque classe au lieu de renvoyer une liste vide", async () => {
    vi.spyOn(api, "classes").mockResolvedValue({ items: [classe], total: 1, page: 1, pageSize: 100 });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        expect(url).toContain("/api/analyses/classe");
        expect(url).toContain("classeId=classe-6a");
        return Response.json({
          eleves: [
            {
              matieres: [{ matiereId: "pc", nom: "Physique-Chimie", moyenne: 15 }],
            },
          ],
        });
      }),
    );
    await expect(api.moyennesMatieres({ anneeId: "annee" })).resolves.toEqual({
      matieres: [{ matiereId: "pc", nom: "Physique-Chimie", moyenne: 15, effectif: 1 }],
    });
  });

  it("propage une erreur de chargement au lieu d'afficher une série vide", async () => {
    vi.spyOn(api, "classes").mockResolvedValue({ items: [classe], total: 1, page: 1, pageSize: 100 });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "Indisponible." }, { status: 500 })));
    await expect(api.moyennesMatieres({ anneeId: "annee" })).rejects.toBeInstanceOf(ApiError);
  });
});

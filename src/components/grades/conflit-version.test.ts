import { describe, expect, it } from "vitest";
import { lignesEnConflit } from "@/components/grades/conflit-version";
import type { ConflitVersionNote, LigneGrille } from "@/lib/api-client/types";

const lignes: LigneGrille[] = [
  {
    eleveId: "eleve-1",
    matricule: "A1",
    nom: "Martin",
    prenom: "Camille",
    valeur: 14,
    absent: false,
    commentaire: null,
    version: "2026-09-30T09:16:00.123Z",
  },
  {
    eleveId: "eleve-2",
    matricule: "A2",
    nom: "Durand",
    prenom: "Léa",
    valeur: null,
    absent: false,
    commentaire: null,
    version: null,
  },
];

describe("lignes en conflit de version", () => {
  it("nomme les élèves sans recopier la version ni la valeur", () => {
    const conflits: ConflitVersionNote[] = [
      {
        index: 0,
        noteId: "note-1",
        eleveId: "eleve-1",
        evaluationId: "eval-1",
        version: "2026-09-30T10:00:00.000Z",
      },
      {
        index: 0,
        noteId: "note-1",
        eleveId: "eleve-1",
        evaluationId: "eval-1",
        version: "2026-09-30T10:00:00.000Z",
      },
      {
        index: 1,
        noteId: null,
        eleveId: "eleve-2",
        evaluationId: "eval-1",
        version: null,
      },
      {
        index: null,
        noteId: "note-x",
        eleveId: "inconnu",
        evaluationId: "eval-1",
        version: "2026-09-30T10:00:00.000Z",
      },
    ];
    const visibles = lignesEnConflit(conflits, lignes);
    expect(visibles).toEqual([
      { eleveId: "eleve-1", nom: "Martin Camille", disparue: false, suppression: false },
      { eleveId: "eleve-2", nom: "Durand Léa", disparue: true, suppression: false },
      { eleveId: "inconnu", nom: "Une ligne", disparue: false, suppression: true },
    ]);
    expect(JSON.stringify(visibles)).not.toContain("2026-09-30");
    expect(JSON.stringify(visibles)).not.toContain("14");
    expect(JSON.stringify(visibles)).not.toContain("note-1");
  });
});

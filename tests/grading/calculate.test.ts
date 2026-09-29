import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appreciate,
  computeOverallAverage,
  computeSubjectAverage,
  rankCompetition,
  toScale20,
} from "../../src/lib/grading";

describe("calcul des moyennes", () => {
  it("ramène une note sur 20", () => {
    assert.equal(toScale20(8, 10), 16);
    assert.equal(toScale20(15, 20), 15);
  });

  it("calcule la moyenne de matière (15×4 + 12×2) / (4+2) = 14", () => {
    const moyenne = computeSubjectAverage([
      { score: 15, maxScore: 20, coefficient: 4 },
      { score: 12, maxScore: 20, coefficient: 2 },
    ]);
    assert.equal(moyenne.value, 14);
  });

  it("calcule la moyenne générale avec les coefficients de matières", () => {
    const moyenne = computeOverallAverage([
      { coefficient: 4, average: 15 },
      { coefficient: 2, average: 12 },
    ]);
    assert.equal(moyenne.value, 14);
  });

  it("normalise les barèmes différents avant de pondérer", () => {
    const moyenne = computeSubjectAverage([
      { score: 8, maxScore: 10, coefficient: 1 },
      { score: 10, maxScore: 20, coefficient: 1 },
    ]);
    assert.equal(moyenne.value, 13);
  });

  it("exclut une note absente du numérateur et du dénominateur", () => {
    const moyenne = computeSubjectAverage([
      { score: 15, maxScore: 20, coefficient: 4 },
      { score: 0, maxScore: 20, coefficient: 2, absent: true },
    ]);
    assert.equal(moyenne.value, 15);
  });

  it("retourne null si toutes les notes sont absentes", () => {
    const moyenne = computeSubjectAverage([
      { score: 0, maxScore: 20, coefficient: 1, absent: true },
    ]);
    assert.equal(moyenne.value, null);
  });

  it("exclut une matière sans moyenne de la moyenne générale", () => {
    const moyenne = computeOverallAverage([
      { coefficient: 4, average: null },
      { coefficient: 2, average: 12 },
    ]);
    assert.equal(moyenne.value, 12);
  });

  it("arrondit au centième", () => {
    const moyenne = computeSubjectAverage([
      { score: 10, maxScore: 20, coefficient: 1 },
      { score: 11, maxScore: 20, coefficient: 1 },
      { score: 12, maxScore: 20, coefficient: 1 },
    ]);
    assert.equal(moyenne.value, 11);
  });
});

describe("appréciation et rang", () => {
  it("applique le barème inclusif", () => {
    assert.equal(appreciate(16).label, "Très bien");
    assert.equal(appreciate(15.99).label, "Bien");
    assert.equal(appreciate(14).label, "Bien");
    assert.equal(appreciate(12).label, "Assez bien");
    assert.equal(appreciate(10).label, "Passable");
    assert.equal(appreciate(8).label, "Insuffisant");
    assert.equal(appreciate(7.99).label, "Très insuffisant");
  });

  it("classe au rang de compétition 1, 2, 2, 4 et laisse les non notés sans rang", () => {
    const rangs = rankCompetition(
      [
        { eleveId: "a", moyenne: 18 },
        { eleveId: "b", moyenne: 15 },
        { eleveId: "c", moyenne: 15 },
        { eleveId: "d", moyenne: 10 },
        { eleveId: "e", moyenne: null },
      ],
      (ligne) => ligne.moyenne,
    );
    const parEleve = new Map(rangs.map((ligne) => [ligne.item.eleveId, ligne.rank]));
    assert.equal(parEleve.get("a"), 1);
    assert.equal(parEleve.get("b"), 2);
    assert.equal(parEleve.get("c"), 2);
    assert.equal(parEleve.get("d"), 4);
    assert.equal(parEleve.get("e"), null);
  });
});

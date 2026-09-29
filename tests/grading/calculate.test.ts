import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appreciationPourMoyenne,
  classer,
  moyenneGenerale,
  moyenneMatiere,
  noteSurVingt,
} from "../../src/lib/grading";

describe("calcul des moyennes", () => {
  it("ramène une note sur 20", () => {
    assert.equal(noteSurVingt(8, 10), 16);
    assert.equal(noteSurVingt(15, 20), 15);
  });

  it("calcule la moyenne de matière (15×4 + 12×2) / (4+2) = 14", () => {
    const moyenne = moyenneMatiere([
      { valeur: 15, absent: false, noteMax: 20, coefficient: 4 },
      { valeur: 12, absent: false, noteMax: 20, coefficient: 2 },
    ]);
    assert.equal(moyenne, 14);
  });

  it("calcule la moyenne générale avec les coefficients de matières", () => {
    const moyenne = moyenneGenerale([
      { matiereId: "fr", coefficient: 4, moyenne: 15 },
      { matiereId: "eps", coefficient: 2, moyenne: 12 },
    ]);
    assert.equal(moyenne, 14);
  });

  it("normalise les barèmes différents avant de pondérer", () => {
    const moyenne = moyenneMatiere([
      { valeur: 8, absent: false, noteMax: 10, coefficient: 1 },
      { valeur: 10, absent: false, noteMax: 20, coefficient: 1 },
    ]);
    assert.equal(moyenne, 13);
  });

  it("exclut une note absente du numérateur et du dénominateur", () => {
    const moyenne = moyenneMatiere([
      { valeur: 15, absent: false, noteMax: 20, coefficient: 4 },
      { valeur: null, absent: true, noteMax: 20, coefficient: 2 },
    ]);
    assert.equal(moyenne, 15);
  });

  it("retourne null si toutes les notes sont absentes", () => {
    assert.equal(
      moyenneMatiere([{ valeur: null, absent: true, noteMax: 20, coefficient: 1 }]),
      null,
    );
  });

  it("exclut une matière sans moyenne de la moyenne générale", () => {
    const moyenne = moyenneGenerale([
      { matiereId: "math", coefficient: 4, moyenne: null },
      { matiereId: "hg", coefficient: 2, moyenne: 12 },
    ]);
    assert.equal(moyenne, 12);
  });

  it("arrondit au centième", () => {
    const moyenne = moyenneMatiere([
      { valeur: 10, absent: false, noteMax: 20, coefficient: 1 },
      { valeur: 11, absent: false, noteMax: 20, coefficient: 1 },
      { valeur: 12, absent: false, noteMax: 20, coefficient: 1 },
    ]);
    assert.equal(moyenne, 11);
  });
});

describe("appréciation et rang", () => {
  it("applique le barème inclusif", () => {
    assert.equal(appreciationPourMoyenne(16), "Très bien");
    assert.equal(appreciationPourMoyenne(15.99), "Bien");
    assert.equal(appreciationPourMoyenne(14), "Bien");
    assert.equal(appreciationPourMoyenne(12), "Assez bien");
    assert.equal(appreciationPourMoyenne(10), "Passable");
    assert.equal(appreciationPourMoyenne(8), "Insuffisant");
    assert.equal(appreciationPourMoyenne(7.99), "Très insuffisant");
    assert.equal(appreciationPourMoyenne(null), "Non noté");
  });

  it("classe au rang concours et laisse les non notés sans rang", () => {
    const rangs = classer([
      { eleveId: "a", moyenne: 14 },
      { eleveId: "b", moyenne: 14 },
      { eleveId: "c", moyenne: 12 },
      { eleveId: "d", moyenne: null },
    ]);
    assert.equal(rangs.get("a"), 1);
    assert.equal(rangs.get("b"), 1);
    assert.equal(rangs.get("c"), 3);
    assert.equal(rangs.get("d"), null);
  });
});

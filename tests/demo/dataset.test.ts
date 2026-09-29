import assert from "node:assert/strict";
import { describe, it } from "node:test";
import bcrypt from "bcryptjs";
import { DEMO_PASSWORD, DEMO_PASSWORD_HASH } from "../../src/db/demo-password";
import { NOMS, PRENOMS_F, PRENOMS_M, buildDemoDataset } from "../../src/db/demo/dataset";

describe("jeu de démonstration", () => {
  const dataset = buildDemoDataset();

  it("contient le volume demandé", () => {
    assert.equal(PRENOMS_F.length, 28);
    assert.equal(PRENOMS_M.length, 28);
    assert.equal(NOMS.length, 56);
    assert.equal(dataset.annees.length, 2);
    assert.equal(dataset.classes.length, 4);
    assert.equal(dataset.enseignants.length, 10);
    assert.equal(dataset.matieres.length, 8);
    assert.equal(dataset.eleves.length, 56);
    assert.ok(dataset.notes.length >= 200);
    assert.equal(dataset.utilisateurs.length, 5);
    assert.equal(new Set(dataset.utilisateurs.map((user) => user.roleCode)).size, 5);
  });

  it("est déterministe", () => {
    const again = buildDemoDataset();
    assert.deepEqual(again.notes[0], dataset.notes[0]);
    assert.equal(again.notes.length, dataset.notes.length);
    assert.equal(again.eleves[55].matricule, dataset.eleves[55].matricule);
  });

  it("respecte les bornes des notes et varie les profils", () => {
    const presentes = dataset.notes.filter((row) => !row.estAbsent);
    const absentes = dataset.notes.filter((row) => row.estAbsent);
    assert.ok(absentes.length > 0);
    assert.ok(presentes.some((row) => (row.valeur ?? 0) >= 16));
    assert.ok(presentes.some((row) => (row.valeur ?? 20) <= 8));

    const maxParEvaluation = new Map(dataset.evaluations.map((row) => [row.id, row.noteMax]));
    for (const row of dataset.notes) {
      if (row.estAbsent) {
        assert.equal(row.valeur, null);
        continue;
      }
      assert.ok(row.valeur !== null && row.valeur >= 0);
      assert.ok(row.valeur <= maxParEvaluation.get(row.evaluationId)!);
    }
  });

  it("garde les évaluations dans leur période et une affectation par classe et matière", () => {
    const periodes = new Map(dataset.periodes.map((row) => [row.id, row]));
    for (const evaluation of dataset.evaluations) {
      const periode = periodes.get(evaluation.periodeId)!;
      assert.ok(evaluation.date >= periode.dateDebut && evaluation.date <= periode.dateFin);
    }

    const couples = dataset.affectations.map((row) => `${row.classeId}:${row.matiereId}`);
    assert.equal(new Set(couples).size, couples.length);
    assert.equal(couples.length, 4 * 8);
  });

  it("reconnaît le mot de passe de démonstration", () => {
    assert.equal(bcrypt.compareSync(DEMO_PASSWORD, DEMO_PASSWORD_HASH), true);
    assert.equal(bcrypt.compareSync("autre-mot-de-passe", DEMO_PASSWORD_HASH), false);
  });
});

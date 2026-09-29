import "dotenv/config";
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL est requis pour les tests de contraintes.");
}

const sql = postgres(databaseUrl, { max: 1 });

after(async () => {
  await sql.end({ timeout: 5 });
});

function codeOf(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return undefined;
}

describe("contraintes PostgreSQL", () => {
  it("le seed est chargé avec le volume attendu", async () => {
    const [row] = await sql<{
      eleves: string;
      classes: string;
      enseignants: string;
      matieres: string;
      annees: string;
      notes: string;
    }[]>`
      SELECT
        (SELECT count(*) FROM eleve) AS eleves,
        (SELECT count(*) FROM classe) AS classes,
        (SELECT count(*) FROM enseignant) AS enseignants,
        (SELECT count(*) FROM matiere) AS matieres,
        (SELECT count(*) FROM annee_scolaire) AS annees,
        (SELECT count(*) FROM note) AS notes
    `;
    assert.ok(Number(row.eleves) >= 50, `élèves=${row.eleves}`);
    assert.equal(Number(row.classes), 4);
    assert.equal(Number(row.enseignants), 10);
    assert.equal(Number(row.matieres), 8);
    assert.equal(Number(row.annees), 2);
    assert.ok(Number(row.notes) >= 200, `notes=${row.notes}`);
  });

  it("refuse un matricule dupliqué", async () => {
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`
            INSERT INTO eleve (matricule, nom, prenom, date_naissance, sexe, statut)
            SELECT matricule, 'Doublon', 'Test', date_naissance, sexe, 'ACTIF'
            FROM eleve
            LIMIT 1
          `;
        }),
      (error: unknown) => {
        assert.equal(codeOf(error), "23505");
        return true;
      },
    );
  });

  it("refuse une deuxième note pour le même élève et la même évaluation", async () => {
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`
            INSERT INTO note (eleve_id, evaluation_id, valeur, est_absent)
            SELECT eleve_id, evaluation_id, valeur, est_absent
            FROM note
            WHERE est_absent = false
            LIMIT 1
          `;
        }),
      (error: unknown) => {
        assert.equal(codeOf(error), "23505");
        return true;
      },
    );
  });

  it("refuse une note négative", async () => {
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`
            UPDATE note
            SET valeur = -1
            WHERE id = (SELECT id FROM note WHERE est_absent = false LIMIT 1)
          `;
        }),
      (error: unknown) => {
        assert.equal(codeOf(error), "23514");
        assert.match(String(error), /note_valeur_non_negative/);
        return true;
      },
    );
  });

  it("accepte une note égale au maximum", async () => {
    try {
      await sql.begin(async (tx) => {
        await tx`
          UPDATE note AS n
          SET valeur = e.note_max
          FROM evaluation AS e
          WHERE n.evaluation_id = e.id
            AND n.id = (SELECT id FROM note WHERE est_absent = false LIMIT 1)
        `;
        throw new Error("ROLLBACK_ATTENDU");
      });
      assert.fail("la transaction aurait dû être annulée");
    } catch (error) {
      assert.equal(error instanceof Error ? error.message : "", "ROLLBACK_ATTENDU");
    }
  });

  it("refuse une note supérieure au maximum de l'évaluation", async () => {
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`
            UPDATE note AS n
            SET valeur = e.note_max + 0.01
            FROM evaluation AS e
            WHERE n.evaluation_id = e.id
              AND n.id = (SELECT id FROM note WHERE est_absent = false LIMIT 1)
          `;
        }),
      (error: unknown) => {
        assert.equal(codeOf(error), "23514");
        assert.match(String(error), /note_depasse_maximum/);
        return true;
      },
    );
  });

  it("refuse une note dont l'évaluation n'existe pas", async () => {
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx`
            INSERT INTO note (eleve_id, evaluation_id, valeur, est_absent)
            SELECT id, '00000000-0000-4000-8000-ffffffffffff', 10, false
            FROM eleve
            LIMIT 1
          `;
        }),
      (error: unknown) => {
        assert.equal(codeOf(error), "23503");
        return true;
      },
    );
  });
});

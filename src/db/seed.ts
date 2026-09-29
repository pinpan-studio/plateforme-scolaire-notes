import "dotenv/config";
import { sql } from "drizzle-orm";
import { createDb } from "./client";
import { buildDemoDataset } from "./demo/dataset";
import {
  affectationEnseignant,
  anneeScolaire,
  classe,
  eleve,
  enseignant,
  etablissement,
  evaluation,
  inscription,
  matiere,
  niveau,
  note,
  periode,
  role,
  utilisateur,
} from "./schema";

function without<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Omit<T, K> {
  const copy = { ...row };
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

async function insertChunks<T extends Record<string, unknown>>(
  insert: (rows: T[]) => Promise<unknown>,
  rows: T[],
  size = 400,
) {
  for (let offset = 0; offset < rows.length; offset += size) {
    await insert(rows.slice(offset, offset + size));
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_CONFIRM !== "oui") {
    throw new Error(
      "Seed refusé en production. Réservé à une base de démonstration (SEED_CONFIRM=oui).",
    );
  }

  const dataset = buildDemoDataset();
  const { client, db } = createDb();

  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql.raw(
          "TRUNCATE etablissement, niveau, enseignant, matiere, eleve, role RESTART IDENTITY CASCADE",
        ),
      );

      await tx.insert(role).values(dataset.roles);
      await tx.insert(etablissement).values(dataset.etablissement);
      await tx.insert(anneeScolaire).values(dataset.annees);
      await tx.insert(niveau).values(dataset.niveaux);
      await tx.insert(periode).values(dataset.periodes);
      await tx.insert(enseignant).values(dataset.enseignants.map((row) => without(row, ["key"])));
      await tx.insert(matiere).values(dataset.matieres);
      await tx.insert(classe).values(dataset.classes.map((row) => without(row, ["niveauCode"])));
      await tx.insert(affectationEnseignant).values(dataset.affectations);
      await tx.insert(eleve).values(
        dataset.eleves.map((row) => without(row, ["classeId", "position"])),
      );
      await tx.insert(inscription).values(dataset.inscriptions);
      await insertChunks(
        (rows) => tx.insert(evaluation).values(rows),
        dataset.evaluations,
      );
      await insertChunks((rows) => tx.insert(note).values(rows), dataset.notes);
      await tx.insert(utilisateur).values(dataset.utilisateurs);
    });

    const absents = dataset.notes.filter((row) => row.estAbsent).length;
    console.log(
      [
        "Jeu de démonstration chargé.",
        `établissements=${1}`,
        `années=${dataset.annees.length}`,
        `classes=${dataset.classes.length}`,
        `élèves=${dataset.eleves.length}`,
        `enseignants=${dataset.enseignants.length}`,
        `matières=${dataset.matieres.length}`,
        `périodes=${dataset.periodes.length}`,
        `évaluations=${dataset.evaluations.length}`,
        `notes=${dataset.notes.length}`,
        `absents=${absents}`,
        `utilisateurs=${dataset.utilisateurs.length}`,
      ].join(" "),
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { note } from "@/db/schema";
import { createDb } from "@/db/client";
import { getDb } from "@/server/db";
import { POST as postEvaluations } from "@/app/api/evaluations/route";
import { DELETE as deleteEvaluation } from "@/app/api/evaluations/[id]/route";
import { GET as getNotes } from "@/app/api/notes/route";
import { PATCH as patchNote } from "@/app/api/notes/[id]/route";
import { POST as postLot } from "@/app/api/notes/lot/route";
import { call, jsonOf, login } from "./helpers";

type NotePublique = {
  id: string;
  eleveId: string;
  valeur: number | null;
  version: string;
};

type Conflit = {
  index: number | null;
  noteId: string | null;
  eleveId: string;
  evaluationId: string;
  version: string | null;
};

type ErreurApi = {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
    conflits?: Conflit[];
  };
};

async function contexte() {
  const nathan = await login("nathan.durand@tilleuls.demo");
  const admin = await login("admin@tilleuls.demo");
  const classes = await jsonOf(await call((await import("@/app/api/classes/route")).GET, "/api/classes?pageSize=100", { cookie: admin }));
  const sixieme = (classes.data as Array<{ id: string; nom: string }>).find((row) => row.nom === "6e A")!;
  const matieres = await jsonOf(await call((await import("@/app/api/matieres/route")).GET, "/api/matieres", { cookie: admin }));
  const pc = (matieres as unknown as Array<{ id: string; code: string }>).find((row) => row.code === "PC")!;
  const fr = (matieres as unknown as Array<{ id: string; code: string }>).find((row) => row.code === "FR")!;
  const periodes = await jsonOf(await call((await import("@/app/api/periodes/route")).GET, "/api/periodes", { cookie: admin }));
  const periode = (periodes as unknown as Array<{ id: string; libelle: string; dateDebut: string }>).find(
    (row) => row.libelle.includes("Trimestre 1") && row.dateDebut.startsWith("2025"),
  )!;
  const eleves = await jsonOf(
    await call((await import("@/app/api/eleves/route")).GET, `/api/eleves?classeId=${sixieme.id}&pageSize=20`, { cookie: admin }),
  );
  const evaluations = await jsonOf(
    await call((await import("@/app/api/evaluations/route")).GET, `/api/evaluations?classeId=${sixieme.id}&pageSize=100`, {
      cookie: admin,
    }),
  );
  const evalFr = (evaluations.data as Array<{ id: string; matiereId: string }>).find((row) => row.matiereId === fr.id)!;
  const notesFr = await jsonOf(await call(getNotes, `/api/notes?evaluationId=${evalFr.id}&pageSize=100`, { cookie: admin }));
  const noteFr = (notesFr.data as NotePublique[]).find((row) => row.valeur !== null)!;
  const created = await call(postEvaluations, "/api/evaluations", {
    method: "POST",
    cookie: nathan,
    body: {
      classeId: sixieme.id,
      matiereId: pc.id,
      periodeId: periode.id,
      type: "DEVOIR",
      libelle: "Contrôle version",
      date: "2025-10-08",
      noteMax: 20,
      coefficient: 1,
    },
  });
  expect(created.status).toBe(201);
  const evaluation = (await jsonOf(created)) as { id: string };
  return {
    nathan,
    admin,
    evaluationId: evaluation.id,
    eleves: eleves.data as Array<{ id: string }>,
    evalFrId: evalFr.id,
    noteFr,
  };
}

function ligne(eleveId: string, valeur: number | null, estAbsent: boolean, version: string | null) {
  return { eleveId, valeur, estAbsent, version };
}

async function valeurs(evaluationId: string) {
  return getDb().select().from(note).where(eq(note.evaluationId, evaluationId));
}

describe("version obligatoire des notes", () => {
  it("rejette une version absente, illisible ou un rôle fourni dans le corps", async () => {
    const ctx = await contexte();
    try {
      const sansVersion = await call(patchNote, `/api/notes/${ctx.noteFr.id}`, {
        method: "PATCH",
        cookie: ctx.nathan,
        params: { id: ctx.noteFr.id },
        body: { valeur: 10, estAbsent: false },
      });
      expect(sansVersion.status).toBe(422);
      const detailPatch = (await jsonOf(sansVersion)) as unknown as ErreurApi;
      expect(detailPatch.error.code).toBe("VALIDATION");
      expect(detailPatch.error.details?.some((item) => item.path === "version")).toBe(true);

      const avant = await valeurs(ctx.evaluationId);
      const lotSans = await call(postLot, "/api/notes/lot", {
        method: "POST",
        cookie: ctx.nathan,
        body: {
          evaluationId: ctx.evaluationId,
          lignes: [
            { eleveId: ctx.eleves[0].id, valeur: 15, estAbsent: false },
            ligne(ctx.eleves[1].id, 12, false, null),
          ],
        },
      });
      expect(lotSans.status).toBe(422);
      const detailLot = (await jsonOf(lotSans)) as unknown as ErreurApi;
      expect(detailLot.error.details?.some((item) => item.path === "lignes.0.version" && item.message === "Version requise.")).toBe(
        true,
      );
      expect(await valeurs(ctx.evaluationId)).toHaveLength(avant.length);

      const illisible = await call(postLot, "/api/notes/lot", {
        method: "POST",
        cookie: ctx.nathan,
        body: {
          evaluationId: ctx.evaluationId,
          lignes: [ligne(ctx.eleves[0].id, 15, false, "pas-une-date")],
        },
      });
      expect(illisible.status).toBe(422);
      const detailDate = (await jsonOf(illisible)) as unknown as ErreurApi;
      expect(detailDate.error.details?.some((item) => item.message === "Horodatage invalide.")).toBe(true);

      const role = await call(postLot, "/api/notes/lot", {
        method: "POST",
        cookie: ctx.nathan,
        body: {
          evaluationId: ctx.evaluationId,
          role: "ADMIN",
          lignes: [ligne(ctx.eleves[0].id, 15, false, null)],
        },
      });
      expect(role.status).toBe(422);
      expect(await valeurs(ctx.evaluationId)).toHaveLength(0);
    } finally {
      await getDb().delete(note).where(eq(note.evaluationId, ctx.evaluationId));
      await call(deleteEvaluation, `/api/evaluations/${ctx.evaluationId}`, {
        method: "DELETE",
        cookie: ctx.nathan,
        params: { id: ctx.evaluationId },
      });
    }
  });

  it("répond 409 et n'écrit aucune ligne du lot si une version est périmée", async () => {
    const ctx = await contexte();
    try {
      const creation = await call(postLot, "/api/notes/lot", {
        method: "POST",
        cookie: ctx.nathan,
        body: {
          evaluationId: ctx.evaluationId,
          lignes: [ligne(ctx.eleves[0].id, 10, false, null), ligne(ctx.eleves[1].id, 12, false, null)],
        },
      });
      expect(creation.status).toBe(201);
      const creees = ((await jsonOf(creation)).data as NotePublique[]);
      const premiere = creees.find((row) => row.eleveId === ctx.eleves[0].id)!;
      const seconde = creees.find((row) => row.eleveId === ctx.eleves[1].id)!;

      const lot = await call(postLot, "/api/notes/lot", {
        method: "POST",
        cookie: ctx.nathan,
        body: {
          evaluationId: ctx.evaluationId,
          lignes: [
            ligne(premiere.eleveId, 18, false, premiere.version),
            ligne(seconde.eleveId, 19, false, "2000-01-01T00:00:00.000Z"),
          ],
        },
      });
      expect(lot.status).toBe(409);
      const erreur = (await jsonOf(lot)) as unknown as ErreurApi;
      expect(erreur.error.code).toBe("CONFLIT_VERSION");
      expect(erreur.error.message).toBe("Une ou plusieurs notes ont été modifiées. Rechargez avant d'enregistrer.");
      expect(erreur.error.conflits).toEqual([
        {
          index: 1,
          noteId: seconde.id,
          eleveId: seconde.eleveId,
          evaluationId: ctx.evaluationId,
          version: seconde.version,
        },
      ]);
      expect(JSON.stringify(erreur)).not.toMatch(/"valeur"/);

      const enBase = await valeurs(ctx.evaluationId);
      expect(enBase.find((row) => row.eleveId === premiere.eleveId)?.valeur).toBe(10);
      expect(enBase.find((row) => row.eleveId === seconde.eleveId)?.valeur).toBe(12);

      const dejaLa = await call(postLot, "/api/notes/lot", {
        method: "POST",
        cookie: ctx.nathan,
        body: {
          evaluationId: ctx.evaluationId,
          lignes: [ligne(premiere.eleveId, 7, false, null)],
        },
      });
      expect(dejaLa.status).toBe(409);
      const conflitCreation = (await jsonOf(dejaLa)) as unknown as ErreurApi;
      expect(conflitCreation.error.conflits?.[0]).toMatchObject({
        index: 0,
        noteId: premiere.id,
        version: premiere.version,
      });
      const apresCreation = await valeurs(ctx.evaluationId);
      expect(apresCreation.find((row) => row.eleveId === premiere.eleveId)?.valeur).toBe(10);

      const modifie = await call(patchNote, `/api/notes/${premiere.id}`, {
        method: "PATCH",
        cookie: ctx.nathan,
        params: { id: premiere.id },
        body: { valeur: 14, estAbsent: false, version: premiere.version },
      });
      expect(modifie.status).toBe(200);
      const apres = (await jsonOf(modifie)) as unknown as NotePublique;
      expect(apres.valeur).toBe(14);
      const conflit = await call(patchNote, `/api/notes/${premiere.id}`, {
        method: "PATCH",
        cookie: ctx.nathan,
        params: { id: premiere.id },
        body: { valeur: 8, estAbsent: false, version: premiere.version },
      });
      expect(conflit.status).toBe(409);
      const corps = (await jsonOf(conflit)) as unknown as ErreurApi;
      expect(corps.error.code).toBe("CONFLIT_VERSION");
      expect(corps.error.conflits).toEqual([
        {
          index: null,
          noteId: premiere.id,
          eleveId: premiere.eleveId,
          evaluationId: ctx.evaluationId,
          version: apres.version,
        },
      ]);
      expect(JSON.stringify(corps)).not.toMatch(/"valeur"/);
      const relue = await valeurs(ctx.evaluationId);
      expect(relue.find((row) => row.id === premiere.id)?.valeur).toBe(14);
    } finally {
      await getDb().delete(note).where(eq(note.evaluationId, ctx.evaluationId));
      await call(deleteEvaluation, `/api/evaluations/${ctx.evaluationId}`, {
        method: "DELETE",
        cookie: ctx.nathan,
        params: { id: ctx.evaluationId },
      });
    }
  });

  it("laisse une seule écriture gagner quand deux requêtes partent ensemble", async () => {
    const ctx = await contexte();
    try {
      const creation = await call(postLot, "/api/notes/lot", {
        method: "POST",
        cookie: ctx.nathan,
        body: {
          evaluationId: ctx.evaluationId,
          lignes: [ligne(ctx.eleves[2].id, 9, false, null), ligne(ctx.eleves[3].id, 11, false, null)],
        },
      });
      expect(creation.status).toBe(201);
      const creees = (await jsonOf(creation)).data as NotePublique[];
      const gauche = creees.find((row) => row.eleveId === ctx.eleves[2].id)!;
      const droite = creees.find((row) => row.eleveId === ctx.eleves[3].id)!;

      const [premier, second] = await Promise.all([
        call(patchNote, `/api/notes/${gauche.id}`, {
          method: "PATCH",
          cookie: ctx.nathan,
          params: { id: gauche.id },
          body: { valeur: 13, estAbsent: false, version: gauche.version },
        }),
        call(patchNote, `/api/notes/${gauche.id}`, {
          method: "PATCH",
          cookie: ctx.nathan,
          params: { id: gauche.id },
          body: { valeur: 16, estAbsent: false, version: gauche.version },
        }),
      ]);
      const statutsPatch = [premier.status, second.status].sort();
      expect(statutsPatch).toEqual([200, 409]);
      const gagne = premier.status === 200 ? premier : second;
      const perd = premier.status === 409 ? premier : second;
      const noteGagnante = (await jsonOf(gagne)) as unknown as NotePublique;
      const conflitPatch = (await jsonOf(perd)) as unknown as ErreurApi;
      expect(conflitPatch.error.code).toBe("CONFLIT_VERSION");
      expect(conflitPatch.error.conflits?.[0]?.version).toBe(noteGagnante.version);
      expect(JSON.stringify(conflitPatch)).not.toMatch(/"valeur"/);
      const unitaire = (await valeurs(ctx.evaluationId)).find((row) => row.id === gauche.id);
      expect(unitaire?.valeur).toBe(noteGagnante.valeur);

      const [lotA, lotB] = await Promise.all([
        call(postLot, "/api/notes/lot", {
          method: "POST",
          cookie: ctx.nathan,
          body: {
            evaluationId: ctx.evaluationId,
            lignes: [
              ligne(gauche.eleveId, 4, false, noteGagnante.version),
              ligne(droite.eleveId, 5, false, droite.version),
            ],
          },
        }),
        call(postLot, "/api/notes/lot", {
          method: "POST",
          cookie: ctx.nathan,
          body: {
            evaluationId: ctx.evaluationId,
            lignes: [
              ligne(gauche.eleveId, 6, false, noteGagnante.version),
              ligne(droite.eleveId, 7, false, droite.version),
            ],
          },
        }),
      ]);
      expect([lotA.status, lotB.status].sort()).toEqual([201, 409]);
      const lotGagne = lotA.status === 201 ? lotA : lotB;
      const lotPerd = lotA.status === 409 ? lotA : lotB;
      const enregistrees = ((await jsonOf(lotGagne)).data as NotePublique[]);
      const conflitLot = (await jsonOf(lotPerd)) as unknown as ErreurApi;
      expect(conflitLot.error.code).toBe("CONFLIT_VERSION");
      expect(conflitLot.error.conflits?.length).toBeGreaterThan(0);
      expect(JSON.stringify(conflitLot)).not.toMatch(/"valeur"/);
      const finales = await valeurs(ctx.evaluationId);
      for (const ligneGagnante of enregistrees) {
        expect(finales.find((row) => row.eleveId === ligneGagnante.eleveId)?.valeur).toBe(ligneGagnante.valeur);
      }
      const valeurGauche = finales.find((row) => row.eleveId === gauche.eleveId)?.valeur;
      const valeurDroite = finales.find((row) => row.eleveId === droite.eleveId)?.valeur;
      const lotCoherent =
        (valeurGauche === 4 && valeurDroite === 5) || (valeurGauche === 6 && valeurDroite === 7);
      expect(lotCoherent).toBe(true);
    } finally {
      await getDb().delete(note).where(eq(note.evaluationId, ctx.evaluationId));
      await call(deleteEvaluation, `/api/evaluations/${ctx.evaluationId}`, {
        method: "DELETE",
        cookie: ctx.nathan,
        params: { id: ctx.evaluationId },
      });
    }
  });

  it("relit la version sous verrou et n'écrase pas une écriture engagée entre-temps", async () => {
    const ctx = await contexte();
    const autre = createDb();
    try {
      const creation = await call(postLot, "/api/notes/lot", {
        method: "POST",
        cookie: ctx.nathan,
        body: {
          evaluationId: ctx.evaluationId,
          lignes: [ligne(ctx.eleves[4].id, 8, false, null)],
        },
      });
      expect(creation.status).toBe(201);
      const creee = ((await jsonOf(creation)).data as NotePublique[])[0];
      let enAttente: Promise<Response> | undefined;
      await autre.db.transaction(async (tx) => {
        await tx.select({ id: note.id }).from(note).where(eq(note.id, creee.id)).for("update");
        enAttente = call(patchNote, `/api/notes/${creee.id}`, {
          method: "PATCH",
          cookie: ctx.nathan,
          params: { id: creee.id },
          body: { valeur: 13, estAbsent: false, version: creee.version },
        });
        await new Promise((resolve) => setTimeout(resolve, 400));
        await tx.update(note).set({ valeur: 6.5 }).where(eq(note.id, creee.id));
      });
      const response = await enAttente!;
      expect(response.status).toBe(409);
      const erreur = (await jsonOf(response)) as unknown as ErreurApi;
      expect(erreur.error.code).toBe("CONFLIT_VERSION");
      expect(erreur.error.conflits?.[0]?.noteId).toBe(creee.id);
      expect(erreur.error.conflits?.[0]?.version).not.toBe(creee.version);
      expect(JSON.stringify(erreur)).not.toMatch(/"valeur"/);
      const [enBase] = await getDb().select().from(note).where(eq(note.id, creee.id));
      expect(enBase?.valeur).toBe(6.5);
    } finally {
      await autre.client.end();
      await getDb().delete(note).where(eq(note.evaluationId, ctx.evaluationId));
      await call(deleteEvaluation, `/api/evaluations/${ctx.evaluationId}`, {
        method: "DELETE",
        cookie: ctx.nathan,
        params: { id: ctx.evaluationId },
      });
    }
  });

  it("refuse un enseignant hors affectation et une requête sans session", async () => {
    const ctx = await contexte();
    try {
      const avant = (await getDb().select().from(note).where(eq(note.id, ctx.noteFr.id)))[0];
      const hors = await call(patchNote, `/api/notes/${ctx.noteFr.id}`, {
        method: "PATCH",
        cookie: ctx.nathan,
        params: { id: ctx.noteFr.id },
        body: { valeur: 3, estAbsent: false, version: ctx.noteFr.version },
      });
      expect(hors.status).toBe(403);
      const corpsHors = await jsonOf(hors);
      expect(JSON.stringify(corpsHors)).not.toMatch(/"valeur"/);
      expect(JSON.stringify(corpsHors)).not.toMatch(/conflits/);
      const apres = (await getDb().select().from(note).where(eq(note.id, ctx.noteFr.id)))[0];
      expect(apres?.valeur).toBe(avant?.valeur);

      const lotHors = await call(postLot, "/api/notes/lot", {
        method: "POST",
        cookie: ctx.nathan,
        body: {
          evaluationId: ctx.evalFrId,
          lignes: [ligne(ctx.noteFr.eleveId, 3, false, ctx.noteFr.version)],
        },
      });
      expect(lotHors.status).toBe(403);
      const corpsLot = await jsonOf(lotHors);
      expect(JSON.stringify(corpsLot)).not.toMatch(/"valeur"/);
      expect(JSON.stringify(corpsLot)).not.toMatch(/conflits/);
      const encore = (await getDb().select().from(note).where(eq(note.id, ctx.noteFr.id)))[0];
      expect(encore?.valeur).toBe(avant?.valeur);

      const anonymePatch = await call(patchNote, `/api/notes/${ctx.noteFr.id}`, {
        method: "PATCH",
        params: { id: ctx.noteFr.id },
        body: { valeur: 3, estAbsent: false, version: ctx.noteFr.version },
      });
      expect(anonymePatch.status).toBe(401);
      const corpsPatch = (await jsonOf(anonymePatch)) as unknown as ErreurApi;
      expect(corpsPatch.error.code).toBe("UNAUTHENTICATED");
      expect(JSON.stringify(corpsPatch)).not.toMatch(/"valeur"/);

      const anonymeLot = await call(postLot, "/api/notes/lot", {
        method: "POST",
        body: {
          evaluationId: ctx.evaluationId,
          lignes: [ligne(ctx.eleves[0].id, 15, false, null)],
        },
      });
      expect(anonymeLot.status).toBe(401);
      const corpsAnonyme = (await jsonOf(anonymeLot)) as unknown as ErreurApi;
      expect(corpsAnonyme.error.code).toBe("UNAUTHENTICATED");
      expect(JSON.stringify(corpsAnonyme)).not.toMatch(/"valeur"/);
      expect(await valeurs(ctx.evaluationId)).toHaveLength(0);
    } finally {
      await getDb().delete(note).where(eq(note.evaluationId, ctx.evaluationId));
      await call(deleteEvaluation, `/api/evaluations/${ctx.evaluationId}`, {
        method: "DELETE",
        cookie: ctx.nathan,
        params: { id: ctx.evaluationId },
      });
    }
  });
});

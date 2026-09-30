import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { anneeScolaire, note } from "@/db/schema";
import { computeSubjectAverage } from "@/lib/grading";
import { getDb } from "@/server/db";
import { GET as getEvaluations, POST as postEvaluations } from "@/app/api/evaluations/route";
import { DELETE as deleteEvaluation, PATCH as patchEvaluation } from "@/app/api/evaluations/[id]/route";
import { GET as getNotes, POST as postNotes } from "@/app/api/notes/route";
import { DELETE as deleteNote, GET as getNote, PATCH as patchNote } from "@/app/api/notes/[id]/route";
import { POST as postLot } from "@/app/api/notes/lot/route";
import { POST as postValider } from "@/app/api/notes/valider/route";
import { GET as getBulletins } from "@/app/api/bulletins/route";
import { GET as getClasseAnalyse } from "@/app/api/analyses/classe/route";
import { GET as getEtab } from "@/app/api/analyses/etablissement/route";
import { call, jsonOf, login } from "./helpers";

async function contexte() {
  const admin = await login("admin@tilleuls.demo");
  const nathan = await login("nathan.durand@tilleuls.demo");
  const camille = await login("camille.martin@tilleuls.demo");
  const direction = await login("direction@tilleuls.demo");
  const consultation = await login("consultation@tilleuls.demo");
  const classes = await jsonOf(await call((await import("@/app/api/classes/route")).GET, "/api/classes?pageSize=100", { cookie: admin }));
  const sixieme = (classes.data as Array<{ id: string; nom: string }>).find((row) => row.nom === "6e A")!;
  const evaluations = await jsonOf(
    await call(getEvaluations, `/api/evaluations?classeId=${sixieme.id}&pageSize=100`, { cookie: admin }),
  );
  const matieres = await jsonOf(await call((await import("@/app/api/matieres/route")).GET, "/api/matieres", { cookie: admin }));
  const pc = (matieres as unknown as Array<{ id: string; code: string }>).find((row) => row.code === "PC")!;
  const fr = (matieres as unknown as Array<{ id: string; code: string }>).find((row) => row.code === "FR")!;
  const evalPc = (evaluations.data as Array<{ id: string; matiereId: string; noteMax: number }>).find(
    (row) => row.matiereId === pc.id,
  )!;
  const evalFr = (evaluations.data as Array<{ id: string; matiereId: string }>).find((row) => row.matiereId === fr.id)!;
  const notesPc = await jsonOf(await call(getNotes, `/api/notes?evaluationId=${evalPc.id}&pageSize=100`, { cookie: admin }));
  const notePc = (notesPc.data as Array<{ id: string; eleveId: string; valeur: number | null; estAbsent: boolean; version: string }>)[0];
  const notesFr = await jsonOf(await call(getNotes, `/api/notes?evaluationId=${evalFr.id}&pageSize=100`, { cookie: admin }));
  const noteFr = (notesFr.data as Array<{ id: string; valeur: number | null; version: string; estAbsent: boolean }>).find(
    (row) => !row.estAbsent,
  )!;
  const eleves = await jsonOf(
    await call((await import("@/app/api/eleves/route")).GET, `/api/eleves?classeId=${sixieme.id}&pageSize=20`, { cookie: admin }),
  );
  return { admin, nathan, camille, direction, consultation, sixieme, pc, fr, evalPc, evalFr, notePc, noteFr, eleves: eleves.data as Array<{ id: string }> };
}

describe("notes et autorisations", () => {
  it("interdit à un enseignant de modifier une note hors affectation", async () => {
    const ctx = await contexte();
    const avant = await jsonOf(await call(getNote, `/api/notes/${ctx.noteFr.id}`, { cookie: ctx.admin, params: { id: ctx.noteFr.id } }));
    const refus = await call(patchNote, `/api/notes/${ctx.noteFr.id}`, {
      method: "PATCH",
      cookie: ctx.nathan,
      params: { id: ctx.noteFr.id },
      body: { valeur: 10, estAbsent: false, version: ctx.noteFr.version },
    });
    expect(refus.status).toBe(403);
    const apres = await jsonOf(await call(getNote, `/api/notes/${ctx.noteFr.id}`, { cookie: ctx.admin, params: { id: ctx.noteFr.id } }));
    expect(apres.valeur).toBe(avant.valeur);

    const lecture = await call(getNotes, `/api/notes?evaluationId=${ctx.evalFr.id}`, { cookie: ctx.nathan });
    expect(lecture.status).toBe(403);
    expect(JSON.stringify(await jsonOf(lecture))).not.toContain("valeur");

    const pp = await call(getNotes, `/api/notes?evaluationId=${ctx.evalPc.id}&pageSize=5`, { cookie: ctx.camille });
    expect(pp.status).toBe(200);

    const direction = await call(patchNote, `/api/notes/${ctx.notePc.id}`, {
      method: "PATCH",
      cookie: ctx.direction,
      params: { id: ctx.notePc.id },
      body: { valeur: 11, estAbsent: false },
    });
    expect(direction.status).toBe(403);
    const consultation = await call(postNotes, "/api/notes", {
      method: "POST",
      cookie: ctx.consultation,
      body: { evaluationId: ctx.evalPc.id, eleveId: ctx.notePc.eleveId, valeur: 12, estAbsent: false },
    });
    expect(consultation.status).toBe(403);

    const sansCookie = await call(getNotes, `/api/notes?evaluationId=${ctx.evalPc.id}`);
    expect(sansCookie.status).toBe(401);
  });

  it("saisit, valide, modifie et supprime une note dans le périmètre", async () => {
    const ctx = await contexte();
    const periodes = await jsonOf(
      await call((await import("@/app/api/periodes/route")).GET, "/api/periodes", { cookie: ctx.admin }),
    );
    const periode = (periodes as unknown as Array<{ id: string; libelle: string; dateDebut: string }>).find((row) =>
      row.libelle.includes("Trimestre 1") && row.dateDebut.startsWith("2025"),
    )!;
    const created = await call(postEvaluations, "/api/evaluations", {
      method: "POST",
      cookie: ctx.nathan,
      body: {
        classeId: ctx.sixieme.id,
        matiereId: ctx.pc.id,
        periodeId: periode.id,
        type: "DEVOIR",
        libelle: "Contrôle API",
        date: "2025-10-06",
        noteMax: 20,
        coefficient: 1,
      },
    });
    expect(created.status).toBe(201);
    const evaluation = await jsonOf(created);
    const hors = await call(postEvaluations, "/api/evaluations", {
      method: "POST",
      cookie: ctx.nathan,
      body: {
        classeId: ctx.sixieme.id,
        matiereId: ctx.fr.id,
        periodeId: periode.id,
        type: "DEVOIR",
        libelle: "Français interdit",
        date: "2025-10-06",
        noteMax: 20,
        coefficient: 1,
      },
    });
    expect(hors.status).toBe(403);

    const eleveId = ctx.eleves[0].id;
    const negatif = await call(postNotes, "/api/notes", {
      method: "POST",
      cookie: ctx.nathan,
      body: { evaluationId: evaluation.id, eleveId, valeur: -0.01, estAbsent: false },
    });
    expect(negatif.status).toBe(422);
    const trop = await call(postNotes, "/api/notes", {
      method: "POST",
      cookie: ctx.nathan,
      body: { evaluationId: evaluation.id, eleveId, valeur: 20.01, estAbsent: false },
    });
    expect(trop.status).toBe(422);
    const melange = await call(postNotes, "/api/notes", {
      method: "POST",
      cookie: ctx.nathan,
      body: { evaluationId: evaluation.id, eleveId, valeur: 15, estAbsent: true },
    });
    expect(melange.status).toBe(422);
    const zero = await call(postNotes, "/api/notes", {
      method: "POST",
      cookie: ctx.nathan,
      body: { evaluationId: evaluation.id, eleveId, valeur: 0, estAbsent: false },
    });
    expect(zero.status).toBe(201);
    const noteZero = await jsonOf(zero);
    const doublon = await call(postNotes, "/api/notes", {
      method: "POST",
      cookie: ctx.nathan,
      body: { evaluationId: evaluation.id, eleveId, valeur: 10, estAbsent: false },
    });
    expect(doublon.status).toBe(409);
    expect(((await jsonOf(doublon)).error as { code: string }).code).toBe("CONFLIT");
    const inchangee = (await getDb().select().from(note).where(eq(note.id, String(noteZero.id))))[0];
    expect(inchangee?.valeur).toBe(0);

    const modifie = await call(patchNote, `/api/notes/${noteZero.id}`, {
      method: "PATCH",
      cookie: ctx.nathan,
      params: { id: String(noteZero.id) },
      body: { valeur: 14, estAbsent: false, version: noteZero.version },
    });
    expect(modifie.status).toBe(200);
    const noteModifiee = await jsonOf(modifie);
    expect(noteModifiee.valeur).toBe(14);
    const conflit = await call(patchNote, `/api/notes/${noteZero.id}`, {
      method: "PATCH",
      cookie: ctx.nathan,
      params: { id: String(noteZero.id) },
      body: { valeur: 12, estAbsent: false, version: noteZero.version },
    });
    expect(conflit.status).toBe(409);

    const secours = ctx.eleves[1].id;
    const avant = await getDb().select({ id: note.id }).from(note).where(eq(note.evaluationId, String(evaluation.id)));
    const lotInvalide = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: ctx.nathan,
      body: {
        evaluationId: evaluation.id,
        lignes: [
          { eleveId: secours, valeur: 15, estAbsent: false, version: null },
          { eleveId: ctx.eleves[2].id, valeur: 21, estAbsent: false, version: null },
        ],
      },
    });
    expect(lotInvalide.status).toBe(422);
    const apresInvalide = await getDb().select({ id: note.id }).from(note).where(eq(note.evaluationId, String(evaluation.id)));
    expect(apresInvalide.length).toBe(avant.length);

    const lotHostile = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: ctx.nathan,
      body: {
        lignes: [
          { evaluationId: evaluation.id, eleveId: secours, valeur: 15, estAbsent: false, version: null },
          { evaluationId: ctx.evalFr.id, eleveId: secours, valeur: 12, estAbsent: false, version: null },
        ],
      },
    });
    expect(lotHostile.status).toBe(403);
    const apresHostile = await getDb().select({ id: note.id }).from(note).where(eq(note.evaluationId, String(evaluation.id)));
    expect(apresHostile.length).toBe(avant.length);

    const validation = await call(postValider, "/api/notes/valider", {
      method: "POST",
      cookie: ctx.nathan,
      body: {
        evaluationId: evaluation.id,
        lignes: [
          { eleveId: secours, valeur: 15, estAbsent: false, version: null },
          { eleveId: ctx.eleves[2].id, valeur: null, estAbsent: true, version: null },
        ],
      },
    });
    expect(validation.status).toBe(200);
    expect((await jsonOf(validation)).valide).toBe(true);
    const encore = await getDb().select({ id: note.id }).from(note).where(eq(note.evaluationId, String(evaluation.id)));
    expect(encore.length).toBe(avant.length);

    const lot = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: ctx.nathan,
      body: {
        evaluationId: evaluation.id,
        lignes: [
          { eleveId: secours, valeur: 15, estAbsent: false, version: null },
          { eleveId: ctx.eleves[2].id, valeur: null, estAbsent: true, version: null },
        ],
      },
    });
    expect(lot.status).toBe(201);
    const lotCamille = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: ctx.camille,
      body: {
        evaluationId: evaluation.id,
        lignes: [{ eleveId: secours, valeur: 8, estAbsent: false, version: null }],
      },
    });
    expect(lotCamille.status).toBe(403);
    const valeurSecours = (
      await getDb().select().from(note).where(eq(note.evaluationId, String(evaluation.id)))
    ).find((row) => row.eleveId === secours);
    expect(valeurSecours?.valeur).toBe(15);

    const bulletin = await jsonOf(
      await call(getBulletins, `/api/bulletins?eleveId=${eleveId}`, { cookie: ctx.admin }),
    );
    const lignePc = (bulletin.lignes as Array<{ code: string; moyenne: number | null }>).find((row) => row.code === "PC");
    expect(lignePc?.moyenne).not.toBeNull();
    const brut = await getDb()
      .select({
        valeur: note.valeur,
        estAbsent: note.estAbsent,
      })
      .from(note)
      .where(eq(note.eleveId, eleveId));
    expect(brut.length).toBeGreaterThan(0);
    expect(computeSubjectAverage).toBeTypeOf("function");

    const supprNote = await call(deleteNote, `/api/notes/${noteZero.id}`, {
      method: "DELETE",
      cookie: ctx.nathan,
      params: { id: String(noteZero.id) },
      body: { version: noteModifiee.version },
    });
    expect(supprNote.status).toBe(204);
    const supprEval = await call(deleteEvaluation, `/api/evaluations/${evaluation.id}`, {
      method: "DELETE",
      cookie: ctx.nathan,
      params: { id: String(evaluation.id) },
    });
    expect(supprEval.status).toBe(409);
    await getDb().delete(note).where(eq(note.evaluationId, String(evaluation.id)));
    const supprEval2 = await call(deleteEvaluation, `/api/evaluations/${evaluation.id}`, {
      method: "DELETE",
      cookie: ctx.nathan,
      params: { id: String(evaluation.id) },
    });
    expect(supprEval2.status).toBe(204);

    const [annee] = await getDb().select().from(anneeScolaire).where(eq(anneeScolaire.statut, "EN_COURS"));
    await getDb().update(anneeScolaire).set({ statut: "CLOTUREE" }).where(eq(anneeScolaire.id, annee.id));
    try {
      const ferme = await call(patchNote, `/api/notes/${ctx.notePc.id}`, {
        method: "PATCH",
        cookie: ctx.nathan,
        params: { id: ctx.notePc.id },
        body: { valeur: 9, estAbsent: false, version: ctx.notePc.version },
      });
      expect(ferme.status).toBe(403);
      const avantLibelle = await jsonOf(
        await call((await import("@/app/api/evaluations/[id]/route")).GET, `/api/evaluations/${ctx.evalPc.id}`, {
          cookie: ctx.admin,
          params: { id: ctx.evalPc.id },
        }),
      );
      const adminOk = await call(patchEvaluation, `/api/evaluations/${ctx.evalPc.id}`, {
        method: "PATCH",
        cookie: ctx.admin,
        params: { id: ctx.evalPc.id },
        body: { libelle: String(avantLibelle.libelle) },
      });
      expect(adminOk.status).toBe(200);
    } finally {
      await getDb().update(anneeScolaire).set({ statut: "EN_COURS" }).where(eq(anneeScolaire.id, annee.id));
    }

    const dashboard = await call(getEtab, "/api/analyses/etablissement", { cookie: ctx.nathan });
    expect(dashboard.status).toBe(403);
    const dashboardAdmin = await call(getEtab, "/api/analyses/etablissement", { cookie: ctx.admin });
    expect(dashboardAdmin.status).toBe(200);
    const classe = await call(getClasseAnalyse, `/api/analyses/classe?classeId=${ctx.sixieme.id}`, { cookie: ctx.camille });
    expect(classe.status).toBe(200);
    const horsClasse = await call(getClasseAnalyse, `/api/analyses/classe?classeId=${ctx.sixieme.id}&matiereId=${ctx.fr.id}`, {
      cookie: ctx.nathan,
    });
    expect(horsClasse.status).toBe(403);
  });
});

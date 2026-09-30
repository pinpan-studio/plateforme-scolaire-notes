import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { classe, eleve, evaluation, matiere, note } from "@/db/schema";
import { GET as getAnnees } from "@/app/api/annees/route";
import { GET as getNiveaux } from "@/app/api/niveaux/route";
import { GET as getPeriodes } from "@/app/api/periodes/route";
import { GET as getMatieres, POST as postMatieres } from "@/app/api/matieres/route";
import { GET as getEnseignants } from "@/app/api/enseignants/route";
import { POST as postClasses } from "@/app/api/classes/route";
import { GET as getEleves, POST as postEleves } from "@/app/api/eleves/route";
import { GET as getEleve, PATCH as patchEleve } from "@/app/api/eleves/[id]/route";
import { POST as postAffectations } from "@/app/api/affectations/route";
import { POST as postEvaluations } from "@/app/api/evaluations/route";
import { POST as postLot } from "@/app/api/notes/lot/route";
import { GET as getBulletins } from "@/app/api/bulletins/route";
import { GET as getAnalyseClasse } from "@/app/api/analyses/classe/route";
import { GET as getAnalyseMatiere } from "@/app/api/analyses/matiere/route";
import { GET as getAppreciations, PUT as putAppreciation } from "@/app/api/appreciations-generales/route";
import { getDb } from "@/server/db";
import { call, jsonOf, login } from "./helpers";

type LigneMatiere = {
  matiereId: string;
  code: string;
  nom: string;
  coefficient: number;
  moyenne: number | null;
  appreciation: string;
  rang: number | null;
  effectifClasse: number;
};

type Bulletin = {
  eleve: { id: string; nom: string; prenom: string };
  classe: { id: string; nom: string };
  periode: { id: string | null; libelle: string };
  lignes: LigneMatiere[];
  moyenneGenerale: number | null;
  appreciation: string | null;
  rang: number | null;
  effectif: number | null;
  effectifClasse: number | null;
};

const cree = {
  matiereId: "",
  classes: [] as string[],
  eleves: [] as string[],
  evaluations: [] as string[],
};

async function creer(handler: Parameters<typeof call>[0], path: string, cookie: string, body: unknown) {
  const response = await call(handler, path, { method: "POST", cookie, body });
  const json = await jsonOf(response);
  if (response.status !== 201) {
    throw new Error(`${path} → ${response.status} ${JSON.stringify(json)}`);
  }
  return json;
}

function ligne(bulletin: Bulletin, code: string) {
  const row = bulletin.lignes.find((item) => item.code === code);
  if (!row) throw new Error(`Matière ${code} absente du bulletin`);
  return row;
}

describe("rang du bulletin de démonstration", () => {
  it("classe Hugo Bernard sur sa classe, avec un rang de matière", async () => {
    const admin = await login("admin@tilleuls.demo");
    const nathan = await login("nathan.durand@tilleuls.demo");
    const camille = await login("camille.martin@tilleuls.demo");
    const eleves = await jsonOf(await call(getEleves, "/api/eleves?q=Bernard&pageSize=20", { cookie: admin }));
    const hugo = (eleves.data as Array<{ id: string; nom: string; prenom: string }>).find(
      (row) => row.nom === "Bernard" && row.prenom === "Hugo",
    );
    expect(hugo).toBeTruthy();
    const fiche = await jsonOf(
      await call(getEleve, `/api/eleves/${hugo!.id}`, { cookie: admin, params: { id: hugo!.id } }),
    );
    const classeId = String((fiche.inscription as { classeId: string }).classeId);
    const periodes = (await jsonOf(await call(getPeriodes, "/api/periodes", { cookie: admin }))) as unknown as Array<{
      id: string;
      libelle: string;
      dateDebut: string;
    }>;
    const periode = periodes.find((row) => row.libelle === "Trimestre 1" && row.dateDebut.startsWith("2025"));
    expect(periode).toBeTruthy();

    const bulletin = (await jsonOf(
      await call(getBulletins, `/api/bulletins?eleveId=${hugo!.id}&periodeId=${periode!.id}`, { cookie: admin }),
    )) as unknown as Bulletin;
    const analyse = await jsonOf(
      await call(getAnalyseClasse, `/api/analyses/classe?classeId=${classeId}&periodeId=${periode!.id}`, {
        cookie: admin,
      }),
    );
    const camarades = analyse.eleves as Array<{
      eleveId: string;
      prenom: string;
      nom: string;
      moyenneGenerale: number | null;
      rang: number | null;
      appreciation: string | null;
      effectifClasse: number | null;
    }>;
    const reference = camarades.find((row) => row.eleveId === hugo!.id);
    expect(reference).toBeTruthy();
    expect(bulletin.moyenneGenerale).toBe(reference!.moyenneGenerale);
    expect(bulletin.appreciation).toBe(reference!.appreciation);
    expect(bulletin.rang).toBe(reference!.rang);
    expect(bulletin.effectif).toBe(camarades.length);
    expect(bulletin.effectifClasse).toBe(camarades.filter((row) => row.moyenneGenerale !== null).length);
    const meilleure = Math.max(
      ...camarades.map((row) => row.moyenneGenerale).filter((valeur): valeur is number => valeur !== null),
    );
    expect(bulletin.moyenneGenerale).toBeLessThan(meilleure);
    expect(bulletin.rang).toBeGreaterThan(1);
    expect(bulletin.lignes.every((row) => row.rang === null)).toBe(false);

    for (const matiereLigne of bulletin.lignes) {
      const parMatiere = await jsonOf(
        await call(
          getAnalyseMatiere,
          `/api/analyses/matiere?classeId=${classeId}&matiereId=${matiereLigne.matiereId}&periodeId=${periode!.id}`,
          { cookie: admin },
        ),
      );
      const detail = (parMatiere.eleves as Array<{ eleveId: string; rang: number | null; effectifClasse: number; moyenne: number | null }>).find(
        (row) => row.eleveId === hugo!.id,
      );
      expect(matiereLigne.rang).toBe(detail?.rang ?? null);
      expect(matiereLigne.effectifClasse).toBe(detail?.effectifClasse);
      expect(matiereLigne.moyenne).toBe(detail?.moyenne ?? null);
    }

    const texte = JSON.stringify(bulletin);
    for (const camarade of camarades) {
      if (camarade.eleveId === hugo!.id) continue;
      expect(texte).not.toContain(camarade.prenom);
    }

    const partiel = (await jsonOf(
      await call(getBulletins, `/api/bulletins?eleveId=${hugo!.id}&periodeId=${periode!.id}&matiereId=francais`, {
        cookie: nathan,
      }),
    )) as unknown as Bulletin;
    expect(partiel.lignes.map((row) => row.code)).toEqual(["PC"]);
    expect(partiel.moyenneGenerale).toBeNull();
    expect(partiel.rang).toBeNull();
    expect(partiel.effectif).toBeNull();
    expect(partiel.effectifClasse).toBeNull();
    expect(partiel.appreciation).toBeNull();
    expect(partiel.lignes[0]?.rang).toBe(ligne(bulletin, "PC").rang);
    expect(partiel.lignes[0]?.effectifClasse).toBe(ligne(bulletin, "PC").effectifClasse);
    expect(JSON.stringify(partiel)).not.toMatch(/Français|Mathématiques/);

    const complet = (await jsonOf(
      await call(getBulletins, `/api/bulletins?eleveId=${hugo!.id}&periodeId=${periode!.id}`, { cookie: camille }),
    )) as unknown as Bulletin;
    expect(complet.rang).toBe(bulletin.rang);
    expect(complet.moyenneGenerale).toBe(bulletin.moyenneGenerale);
    expect(complet.appreciation).toBe(bulletin.appreciation);
    expect(complet.lignes).toHaveLength(bulletin.lignes.length);
  });
});

describe("classement d'un bulletin", () => {
  const periodeIds: { courante?: string; suivante?: string } = {};
  const cookies: { admin?: string; nathan?: string; camille?: string; direction?: string; consultation?: string } = {};
  const ids: Record<string, string> = {};
  let classeId = "";
  let soloId = "";

  beforeAll(async () => {
    cookies.admin = await login("admin@tilleuls.demo");
    cookies.nathan = await login("nathan.durand@tilleuls.demo");
    cookies.camille = await login("camille.martin@tilleuls.demo");
    cookies.direction = await login("direction@tilleuls.demo");
    cookies.consultation = await login("consultation@tilleuls.demo");
    const admin = cookies.admin;

    const annees = (await jsonOf(await call(getAnnees, "/api/annees", { cookie: admin }))) as unknown as Array<{
      id: string;
      libelle: string;
    }>;
    const annee = annees.find((row) => row.libelle === "2025-2026");
    const niveaux = (await jsonOf(await call(getNiveaux, "/api/niveaux", { cookie: admin }))) as unknown as Array<{
      id: string;
      code: string;
    }>;
    const niveau = niveaux.find((row) => row.code === "5e");
    const periodes = (await jsonOf(
      await call(getPeriodes, `/api/periodes?anneeScolaireId=${annee!.id}`, { cookie: admin }),
    )) as unknown as Array<{ id: string; libelle: string; ordre: number }>;
    periodeIds.courante = periodes.find((row) => row.ordre === 1)?.id;
    periodeIds.suivante = periodes.find((row) => row.ordre === 2)?.id;
    const matieres = (await jsonOf(await call(getMatieres, "/api/matieres", { cookie: admin }))) as unknown as Array<{
      id: string;
      code: string;
    }>;
    ids.math = matieres.find((row) => row.code === "MATH")!.id;
    ids.fr = matieres.find((row) => row.code === "FR")!.id;
    const vide = await creer(postMatieres, "/api/matieres", admin, {
      code: "VIDE",
      nom: "Matière sans note",
      coefficient: 1,
    });
    ids.vide = String(vide.id);
    cree.matiereId = ids.vide;
    const enseignants = await jsonOf(
      await call(getEnseignants, "/api/enseignants?pageSize=100", { cookie: admin }),
    );
    const nathan = (enseignants.data as Array<{ id: string; email: string }>).find(
      (row) => row.email === "nathan.durand@tilleuls.demo",
    )!;
    const lea = (enseignants.data as Array<{ id: string; email: string }>).find(
      (row) => row.email === "lea.dubois@tilleuls.demo",
    )!;

    const classeRang = await creer(postClasses, "/api/classes", admin, {
      nom: "Rang Test",
      niveauId: niveau!.id,
      anneeScolaireId: annee!.id,
    });
    classeId = String(classeRang.id);
    const classeSolo = await creer(postClasses, "/api/classes", admin, {
      nom: "Rang Solo",
      niveauId: niveau!.id,
      anneeScolaireId: annee!.id,
    });
    soloId = String(classeSolo.id);
    cree.classes.push(classeId, soloId);

    async function eleveDe(matricule: string, prenom: string, cible: string) {
      const row = await creer(postEleves, "/api/eleves", admin, {
        matricule,
        nom: "Rangtest",
        prenom,
        dateNaissance: "2013-04-04",
        sexe: "F",
        classeId: cible,
      });
      const id = String(row.id);
      cree.eleves.push(id);
      ids[prenom] = id;
      return id;
    }

    await eleveDe("RNG-INES", "Ines", classeId);
    await eleveDe("RNG-OMAR", "Omar", classeId);
    await eleveDe("RNG-LINA", "Lina", classeId);
    await eleveDe("RNG-NOE", "Noe", classeId);
    await eleveDe("RNG-PIA", "Pia", classeId);
    await eleveDe("RNG-SOLO", "Solo", soloId);

    for (const [enseignantId, matiereId, cible] of [
      [nathan.id, ids.math, classeId],
      [lea.id, ids.fr, classeId],
      [lea.id, ids.vide, classeId],
      [lea.id, ids.math, soloId],
      [lea.id, ids.fr, soloId],
      [lea.id, ids.vide, soloId],
    ] as const) {
      await creer(postAffectations, "/api/affectations", admin, { enseignantId, classeId: cible, matiereId });
    }

    async function evaluationDe(cible: string, matiereId: string, libelle: string) {
      const row = await creer(postEvaluations, "/api/evaluations", admin, {
        classeId: cible,
        matiereId,
        periodeId: periodeIds.courante,
        type: "DEVOIR",
        libelle,
        date: "2025-10-06",
        noteMax: 20,
        coefficient: 1,
      });
      const id = String(row.id);
      cree.evaluations.push(id);
      return id;
    }

    ids.evalMath = await evaluationDe(classeId, ids.math, "Math Rang");
    ids.evalFr = await evaluationDe(classeId, ids.fr, "Français Rang");
    ids.evalSoloMath = await evaluationDe(soloId, ids.math, "Math Solo");
    ids.evalSoloFr = await evaluationDe(soloId, ids.fr, "Français Solo");

    const lotMath = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: admin,
      body: {
        evaluationId: ids.evalMath,
        lignes: [
          { eleveId: ids.Ines, valeur: 14, estAbsent: false },
          { eleveId: ids.Omar, valeur: 10, estAbsent: false },
          { eleveId: ids.Lina, valeur: 14, estAbsent: false },
          { eleveId: ids.Pia, valeur: null, estAbsent: true },
        ],
      },
    });
    expect(lotMath.status).toBe(201);
    const lotFr = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: admin,
      body: {
        evaluationId: ids.evalFr,
        lignes: [
          { eleveId: ids.Ines, valeur: 10, estAbsent: false },
          { eleveId: ids.Omar, valeur: 14, estAbsent: false },
          { eleveId: ids.Lina, valeur: 8, estAbsent: false },
          { eleveId: ids.Pia, valeur: 10, estAbsent: false },
        ],
      },
    });
    expect(lotFr.status).toBe(201);
    const lotSolo = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: admin,
      body: {
        lignes: [
          { evaluationId: ids.evalSoloMath, eleveId: ids.Solo, valeur: 9, estAbsent: false },
          { evaluationId: ids.evalSoloFr, eleveId: ids.Solo, valeur: 9, estAbsent: false },
        ],
      },
    });
    expect(lotSolo.status).toBe(201);
  });

  afterAll(async () => {
    const db = getDb();
    if (cree.evaluations.length > 0) {
      await db.delete(note).where(inArray(note.evaluationId, cree.evaluations));
      await db.delete(evaluation).where(inArray(evaluation.id, cree.evaluations));
    }
    if (cree.eleves.length > 0) {
      await db.delete(eleve).where(inArray(eleve.id, cree.eleves));
    }
    if (cree.classes.length > 0) {
      await db.delete(classe).where(inArray(classe.id, cree.classes));
    }
    if (cree.matiereId) {
      await db.delete(matiere).where(inArray(matiere.id, [cree.matiereId]));
    }
  });

  async function bulletin(cookie: string, eleveId: string, periodeId = periodeIds.courante, extra = "") {
    return call(getBulletins, `/api/bulletins?eleveId=${eleveId}&periodeId=${periodeId}${extra}`, { cookie });
  }

  it("partage le rang des ex æquo, ignore les élèves sans note et classe un élève seul", async () => {
    const admin = cookies.admin!;
    const ines = (await jsonOf(await bulletin(admin, ids.Ines))) as unknown as Bulletin;
    const omar = (await jsonOf(await bulletin(admin, ids.Omar))) as unknown as Bulletin;
    const lina = (await jsonOf(await bulletin(admin, ids.Lina))) as unknown as Bulletin;
    const noe = (await jsonOf(await bulletin(admin, ids.Noe))) as unknown as Bulletin;
    const pia = (await jsonOf(await bulletin(admin, ids.Pia))) as unknown as Bulletin;
    const solo = (await jsonOf(await bulletin(admin, ids.Solo))) as unknown as Bulletin;

    expect(ines).toMatchObject({
      moyenneGenerale: 12,
      appreciation: "Assez bien",
      rang: 1,
      effectif: 5,
      effectifClasse: 4,
    });
    expect(omar).toMatchObject({ moyenneGenerale: 12, appreciation: "Assez bien", rang: 1, effectifClasse: 4 });
    expect(lina).toMatchObject({ moyenneGenerale: 11, appreciation: "Passable", rang: 3, effectifClasse: 4 });
    expect(pia).toMatchObject({ moyenneGenerale: 10, appreciation: "Passable", rang: 4, effectifClasse: 4 });
    expect(noe).toMatchObject({
      moyenneGenerale: null,
      appreciation: "Non noté",
      rang: null,
      effectif: 5,
      effectifClasse: 4,
    });

    expect(ligne(ines, "MATH")).toMatchObject({ moyenne: 14, rang: 1, effectifClasse: 3, appreciation: "Bien" });
    expect(ligne(lina, "MATH")).toMatchObject({ moyenne: 14, rang: 1, effectifClasse: 3 });
    expect(ligne(omar, "MATH")).toMatchObject({ moyenne: 10, rang: 3, effectifClasse: 3 });
    expect(ligne(pia, "MATH")).toMatchObject({ moyenne: null, rang: null, effectifClasse: 3, appreciation: "Non noté" });
    expect(ligne(noe, "MATH")).toMatchObject({ moyenne: null, rang: null, effectifClasse: 3 });

    expect(ligne(omar, "FR")).toMatchObject({ moyenne: 14, rang: 1, effectifClasse: 4 });
    expect(ligne(ines, "FR")).toMatchObject({ moyenne: 10, rang: 2, effectifClasse: 4 });
    expect(ligne(pia, "FR")).toMatchObject({ moyenne: 10, rang: 2, effectifClasse: 4 });
    expect(ligne(lina, "FR")).toMatchObject({ moyenne: 8, rang: 4, effectifClasse: 4 });
    expect(ligne(noe, "FR")).toMatchObject({ moyenne: null, rang: null, effectifClasse: 4 });

    for (const document of [ines, omar, lina, noe, pia]) {
      expect(ligne(document, "VIDE")).toMatchObject({
        moyenne: null,
        rang: null,
        effectifClasse: 0,
        appreciation: "Non noté",
      });
      const brut = JSON.stringify(document);
      for (const prenom of ["Ines", "Omar", "Lina", "Noe", "Pia", "Solo"]) {
        if (prenom === document.eleve.prenom) continue;
        expect(brut).not.toContain(prenom);
      }
    }

    expect(solo).toMatchObject({
      moyenneGenerale: 9,
      appreciation: "Insuffisant",
      rang: 1,
      effectif: 1,
      effectifClasse: 1,
    });
    expect(ligne(solo, "MATH")).toMatchObject({ moyenne: 9, rang: 1, effectifClasse: 1 });
    expect(ligne(solo, "FR")).toMatchObject({ moyenne: 9, rang: 1, effectifClasse: 1 });
    expect(ligne(solo, "VIDE")).toMatchObject({ moyenne: null, rang: null, effectifClasse: 0 });

    const vide = (await jsonOf(await bulletin(admin, ids.Ines, periodeIds.suivante))) as unknown as Bulletin;
    expect(vide).toMatchObject({
      moyenneGenerale: null,
      appreciation: "Non noté",
      rang: null,
      effectif: 5,
      effectifClasse: 0,
    });
    expect(vide.lignes.every((row) => row.rang === null && row.effectifClasse === 0 && row.moyenne === null)).toBe(true);

    const force = (await jsonOf(await bulletin(admin, ids.Lina, periodeIds.courante, "&rang=1"))) as unknown as Bulletin;
    expect(force.rang).toBe(3);
    expect(ligne(force, "FR").rang).toBe(4);
  });

  it("laisse l'appréciation générale rédigée intacte", async () => {
    const texte = "Travail sérieux, à poursuivre.";
    const enregistre = await call(putAppreciation, "/api/appreciations-generales", {
      method: "PUT",
      cookie: cookies.admin,
      body: { eleveId: ids.Ines, periodeId: periodeIds.courante, texte },
    });
    expect(enregistre.status).toBe(200);
    expect((await jsonOf(enregistre)).texte).toBe(texte);

    const document = (await jsonOf(await bulletin(cookies.admin!, ids.Ines))) as unknown as Bulletin;
    expect(document.appreciation).toBe("Assez bien");
    expect(JSON.stringify(document)).not.toContain(texte);

    const liste = await jsonOf(
      await call(
        getAppreciations,
        `/api/appreciations-generales?eleveId=${ids.Ines}&periodeId=${periodeIds.courante}`,
        { cookie: cookies.admin },
      ),
    );
    expect(liste.appreciations).toEqual([
      { eleveId: ids.Ines, periodeId: periodeIds.courante, texte },
    ]);
  });

  it("exclut un élève sorti du classement", async () => {
    const admin = cookies.admin!;
    const sorti = await creer(postEleves, "/api/eleves", admin, {
      matricule: "RNG-SORTI",
      nom: "Rangtest",
      prenom: "Sorti",
      dateNaissance: "2013-04-04",
      sexe: "M",
      classeId,
    });
    const sortiId = String(sorti.id);
    cree.eleves.push(sortiId);
    const notesSorti = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: admin,
      body: {
        lignes: [
          { evaluationId: ids.evalMath, eleveId: sortiId, valeur: 20, estAbsent: false },
          { evaluationId: ids.evalFr, eleveId: sortiId, valeur: 20, estAbsent: false },
        ],
      },
    });
    expect(notesSorti.status).toBe(201);
    const pendant = (await jsonOf(await bulletin(admin, sortiId))) as unknown as Bulletin;
    expect(pendant).toMatchObject({ moyenneGenerale: 20, rang: 1, effectif: 6, effectifClasse: 5 });
    const decale = (await jsonOf(await bulletin(admin, ids.Ines))) as unknown as Bulletin;
    expect(decale.rang).toBe(2);

    const depart = await call(patchEleve, `/api/eleves/${sortiId}`, {
      method: "PATCH",
      cookie: admin,
      params: { id: sortiId },
      body: { statut: "SORTI" },
    });
    expect(depart.status).toBe(200);
    const apres = (await jsonOf(await bulletin(admin, ids.Ines))) as unknown as Bulletin;
    expect(apres).toMatchObject({ rang: 1, effectif: 5, effectifClasse: 4, moyenneGenerale: 12 });
    const absent = await bulletin(admin, sortiId);
    expect(absent.status).toBe(404);
  });

  it("refuse le bulletin d'un élève hors périmètre", async () => {
    const anonyme = await call(getBulletins, `/api/bulletins?eleveId=${ids.Ines}&periodeId=${periodeIds.courante}`);
    expect(anonyme.status).toBe(401);

    const camille = await bulletin(cookies.camille!, ids.Ines);
    expect(camille.status).toBe(403);
    const refusCamille = JSON.stringify(await jsonOf(camille));
    expect(refusCamille).not.toMatch(/moyenneGenerale|Rangtest|Assez bien/);

    const nathanSolo = await bulletin(cookies.nathan!, ids.Solo);
    expect(nathanSolo.status).toBe(403);
    expect(JSON.stringify(await jsonOf(nathanSolo))).not.toMatch(/moyenneGenerale|Solo|Insuffisant/);

    const nathan = (await jsonOf(await bulletin(cookies.nathan!, ids.Ines))) as unknown as Bulletin;
    expect(nathan.lignes.map((row) => row.code)).toEqual(["MATH"]);
    expect(nathan.lignes[0]).toMatchObject({ moyenne: 14, rang: 1, effectifClasse: 3 });
    expect(nathan.moyenneGenerale).toBeNull();
    expect(nathan.rang).toBeNull();
    expect(nathan.appreciation).toBeNull();
    expect(nathan.effectif).toBeNull();
    expect(nathan.effectifClasse).toBeNull();
    const brutNathan = JSON.stringify(nathan);
    expect(brutNathan).not.toMatch(/Français|Omar|Lina|Noe|Pia|Solo/);

    const direction = (await jsonOf(await bulletin(cookies.direction!, ids.Lina))) as unknown as Bulletin;
    const consultation = (await jsonOf(await bulletin(cookies.consultation!, ids.Lina))) as unknown as Bulletin;
    expect(direction.rang).toBe(3);
    expect(consultation.rang).toBe(3);
    expect(consultation.appreciation).toBe("Passable");
    expect(JSON.stringify(direction)).not.toContain("Ines");
  });
});

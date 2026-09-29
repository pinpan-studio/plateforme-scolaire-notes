import { afterAll, describe, expect, it } from "vitest";
import { GET as getAnnees, POST as postAnnees } from "@/app/api/annees/route";
import { PATCH as patchAnnee } from "@/app/api/annees/[id]/route";
import { GET as getNiveaux } from "@/app/api/niveaux/route";
import { POST as postPeriodes } from "@/app/api/periodes/route";
import { GET as getClasses, POST as postClasses } from "@/app/api/classes/route";
import { POST as postEleves } from "@/app/api/eleves/route";
import { GET as getEleves } from "@/app/api/eleves/route";
import { POST as postMatieres } from "@/app/api/matieres/route";
import { POST as postEnseignants } from "@/app/api/enseignants/route";
import { POST as postUtilisateurs } from "@/app/api/utilisateurs/route";
import { GET as getUtilisateurs } from "@/app/api/utilisateurs/route";
import { POST as postAffectations } from "@/app/api/affectations/route";
import { POST as postEvaluations } from "@/app/api/evaluations/route";
import { POST as postLot } from "@/app/api/notes/lot/route";
import { GET as getAnalyseClasse } from "@/app/api/analyses/classe/route";
import { GET as getAnalyseMatiere } from "@/app/api/analyses/matiere/route";
import { GET as getHealth } from "@/app/api/health/route";
import { call, jsonOf, login } from "./helpers";

/**
 * Parcours E2E-01 → E2E-11 sur l'API réelle.
 * L'année de démonstration 2025-2026 reste la référence du seed : le parcours
 * ouvre 2027-2028, la referme, puis rend le statut d'origine.
 * Les rôles du plan (administrateur, scolarité, enseignant) sont ceux du schéma :
 * ADMIN, DIRECTION (lecture des notes, pas d'inscription), ENSEIGNANT.
 */

const MOT_DE_PASSE = "Parcours-2027!";
const state: {
  admin?: string;
  direction?: string;
  math?: string;
  francais?: string;
  anneeId?: string;
  anneeOrigineId?: string;
  statutOrigine?: string;
  niveauId?: string;
  periodeId?: string;
  classeId?: string;
  mathId?: string;
  frId?: string;
  enseignantMathId?: string;
  enseignantFrId?: string;
  eleves?: Array<{ id: string; matricule: string }>;
  evaluationMathId?: string;
  evaluationFrId?: string;
} = {};

async function creer(handler: Parameters<typeof call>[0], path: string, cookie: string, body: unknown) {
  const response = await call(handler, path, { method: "POST", cookie, body });
  const json = await jsonOf(response);
  return { response, json };
}

describe("parcours métier E2E-01 à E2E-11", () => {
  afterAll(async () => {
    if (!state.admin || !state.anneeOrigineId || !state.anneeId) return;
    if (state.statutOrigine === "EN_COURS") {
      await call(patchAnnee, `/api/annees/${state.anneeId}`, {
        method: "PATCH",
        cookie: state.admin,
        params: { id: state.anneeId },
        body: { statut: "CLOTUREE" },
      });
      await call(patchAnnee, `/api/annees/${state.anneeOrigineId}`, {
        method: "PATCH",
        cookie: state.admin,
        params: { id: state.anneeOrigineId },
        body: { statut: "EN_COURS" },
      });
    }
  });

  it("E2E-01 crée l'année scolaire et la marque active", async () => {
    state.admin = await login("admin@tilleuls.demo");
    state.direction = await login("direction@tilleuls.demo");
    const annees = (await jsonOf(await call(getAnnees, "/api/annees", { cookie: state.admin }))) as unknown as Array<{
      id: string;
      libelle: string;
      statut: string;
    }>;
    const courante = annees.find((annee) => annee.statut === "EN_COURS");
    expect(courante).toBeTruthy();
    state.anneeOrigineId = courante!.id;
    state.statutOrigine = courante!.statut;

    const { response, json } = await creer(postAnnees, "/api/annees", state.admin, {
      libelle: "2027-2028",
      dateDebut: "2027-09-01",
      dateFin: "2028-07-15",
    });
    expect(response.status).toBe(201);
    expect(json.dateDebut).toBe("2027-09-01");
    expect(json.dateFin).toBe("2028-07-15");
    state.anneeId = String(json.id);

    const inversee = await creer(postAnnees, "/api/annees", state.admin, {
      libelle: "2027-2028-inverse",
      dateDebut: "2028-07-15",
      dateFin: "2027-09-01",
    });
    expect(inversee.response.status).toBe(422);

    const fermeture = await call(patchAnnee, `/api/annees/${state.anneeOrigineId}`, {
      method: "PATCH",
      cookie: state.admin,
      params: { id: state.anneeOrigineId },
      body: { statut: "CLOTUREE" },
    });
    expect(fermeture.status).toBe(200);
    const activation = await call(patchAnnee, `/api/annees/${state.anneeId}`, {
      method: "PATCH",
      cookie: state.admin,
      params: { id: state.anneeId },
      body: { statut: "EN_COURS" },
    });
    expect(activation.status).toBe(200);
    expect((await jsonOf(activation)).statut).toBe("EN_COURS");

    const niveaux = (await jsonOf(await call(getNiveaux, "/api/niveaux", { cookie: state.admin }))) as unknown as Array<{
      id: string;
      code: string;
    }>;
    state.niveauId = niveaux.find((niveau) => niveau.code === "3e")!.id;
    const periode = await creer(postPeriodes, "/api/periodes", state.admin, {
      anneeScolaireId: state.anneeId,
      libelle: "Trimestre 1",
      ordre: 1,
      dateDebut: "2027-09-01",
      dateFin: "2027-12-15",
    });
    expect(periode.response.status).toBe(201);
    state.periodeId = String(periode.json.id);
  });

  it("E2E-02 crée la classe 3e B de l'année active", async () => {
    const { response, json } = await creer(postClasses, "/api/classes", state.admin!, {
      nom: "3e B",
      niveauId: state.niveauId,
      anneeScolaireId: state.anneeId,
      professeurPrincipalId: null,
    });
    expect(response.status).toBe(201);
    state.classeId = String(json.id);
    const liste = await jsonOf(
      await call(getClasses, `/api/classes?anneeScolaireId=${state.anneeId}&pageSize=100`, { cookie: state.admin }),
    );
    const trouve = (liste.data as Array<{ id: string; nom: string; effectif: number }>).find((row) => row.id === state.classeId);
    expect(trouve?.nom).toBe("3e B");
    expect(trouve?.effectif).toBe(0);
    const autre = await jsonOf(
      await call(getClasses, `/api/classes?anneeScolaireId=${state.anneeOrigineId}&pageSize=100`, { cookie: state.admin }),
    );
    expect((autre.data as Array<{ id: string }>).some((row) => row.id === state.classeId)).toBe(false);
  });

  it("E2E-03 crée 30 élèves et refuse le matricule dupliqué", async () => {
    const direction = await call(postEleves, "/api/eleves", {
      method: "POST",
      cookie: state.direction,
      body: {
        matricule: "MAT-2027-999",
        nom: "Interdit",
        prenom: "Direction",
        dateNaissance: "2014-01-01",
        sexe: "F",
        classeId: state.classeId,
      },
    });
    expect(direction.status).toBe(403);

    state.eleves = [];
    for (let index = 1; index <= 30; index += 1) {
      const matricule = `MAT-2027-${String(index).padStart(3, "0")}`;
      const { response, json } = await creer(postEleves, "/api/eleves", state.admin!, {
        matricule,
        nom: `Eleve${String(index).padStart(2, "0")}`,
        prenom: "Test",
        dateNaissance: "2014-01-15",
        sexe: index % 2 === 0 ? "M" : "F",
        classeId: state.classeId,
        statut: "INSCRIT",
      });
      expect(response.status).toBe(201);
      expect(json.matricule).toBe(matricule);
      state.eleves.push({ id: String(json.id), matricule });
    }
    const doublon = await creer(postEleves, "/api/eleves", state.admin!, {
      matricule: "MAT-2027-001",
      nom: "Doublon",
      prenom: "Test",
      dateNaissance: "2014-01-15",
      sexe: "F",
      classeId: state.classeId,
    });
    expect(doublon.response.status).toBe(409);
    const liste = await jsonOf(
      await call(getEleves, `/api/eleves?classeId=${state.classeId}&pageSize=100`, { cookie: state.admin }),
    );
    expect(liste.total).toBe(30);
    const recherche = await jsonOf(
      await call(getEleves, `/api/eleves?q=MAT-2027-030&classeId=${state.classeId}`, { cookie: state.admin }),
    );
    expect(recherche.total).toBe(1);
  });

  it("E2E-04 crée les matières et refuse le code en double", async () => {
    const math = await creer(postMatieres, "/api/matieres", state.admin!, {
      code: "QA-MATH",
      nom: "Mathématiques QA",
      coefficient: 4,
      niveauId: null,
    });
    expect(math.response.status).toBe(201);
    expect(math.json.coefficient).toBe(4);
    state.mathId = String(math.json.id);
    const francais = await creer(postMatieres, "/api/matieres", state.admin!, {
      code: "QA-FR",
      nom: "Français QA",
      coefficient: 2,
      niveauId: null,
    });
    expect(francais.response.status).toBe(201);
    expect(francais.json.coefficient).toBe(2);
    state.frId = String(francais.json.id);
    const doublon = await creer(postMatieres, "/api/matieres", state.admin!, {
      code: "QA-MATH",
      nom: "Mathématiques QA bis",
      coefficient: 4,
      niveauId: null,
    });
    expect(doublon.response.status).toBe(409);
  });

  it("E2E-05 crée l'enseignant et lui refuse la création d'une classe", async () => {
    const enseignant = await creer(postEnseignants, "/api/enseignants", state.admin!, {
      nom: "Martin",
      prenom: "Léa",
      email: "qa.math@etab.test",
      telephone: null,
      statut: "ACTIF",
    });
    expect(enseignant.response.status).toBe(201);
    state.enseignantMathId = String(enseignant.json.id);
    const francais = await creer(postEnseignants, "/api/enseignants", state.admin!, {
      nom: "Bernard",
      prenom: "Inès",
      email: "qa.fr@etab.test",
      telephone: null,
      statut: "ACTIF",
    });
    state.enseignantFrId = String(francais.json.id);
    const compte = await creer(postUtilisateurs, "/api/utilisateurs", state.admin!, {
      email: "qa.math@etab.test",
      motDePasse: MOT_DE_PASSE,
      roleCode: "ENSEIGNANT",
      enseignantId: state.enseignantMathId,
      prenom: "Léa",
      nom: "Martin",
    });
    expect(compte.response.status).toBe(201);
    expect(JSON.stringify(compte.json)).not.toContain("motDePasseHash");
    expect(JSON.stringify(compte.json)).not.toContain("$2");
    await creer(postUtilisateurs, "/api/utilisateurs", state.admin!, {
      email: "qa.fr@etab.test",
      motDePasse: MOT_DE_PASSE,
      roleCode: "ENSEIGNANT",
      enseignantId: state.enseignantFrId,
      prenom: "Inès",
      nom: "Bernard",
    });
    state.math = await login("qa.math@etab.test", MOT_DE_PASSE);
    const classe = await call(postClasses, "/api/classes", {
      method: "POST",
      cookie: state.math,
      body: { nom: "3e Z", niveauId: state.niveauId, anneeScolaireId: state.anneeId, professeurPrincipalId: null },
    });
    expect(classe.status).toBe(403);
    const comptes = await jsonOf(await call(getUtilisateurs, "/api/utilisateurs", { cookie: state.admin }));
    expect(JSON.stringify(comptes)).not.toContain("motDePasseHash");
    expect(JSON.stringify(comptes)).not.toContain("$2");
  });

  it("E2E-06 affecte les enseignants et refuse le doublon", async () => {
    const math = await creer(postAffectations, "/api/affectations", state.admin!, {
      enseignantId: state.enseignantMathId,
      classeId: state.classeId,
      matiereId: state.mathId,
    });
    expect(math.response.status).toBe(201);
    const doublon = await creer(postAffectations, "/api/affectations", state.admin!, {
      enseignantId: state.enseignantMathId,
      classeId: state.classeId,
      matiereId: state.mathId,
    });
    expect(doublon.response.status).toBe(409);
    const francais = await creer(postAffectations, "/api/affectations", state.admin!, {
      enseignantId: state.enseignantFrId,
      classeId: state.classeId,
      matiereId: state.frId,
    });
    expect(francais.response.status).toBe(201);
    const auto = await call(postAffectations, "/api/affectations", {
      method: "POST",
      cookie: state.math,
      body: { enseignantId: state.enseignantMathId, classeId: state.classeId, matiereId: state.frId },
    });
    expect(auto.status).toBe(403);
  });

  it("E2E-07 crée l'évaluation de maths et refuse le français à l'enseignant de maths", async () => {
    state.francais = await login("qa.fr@etab.test", MOT_DE_PASSE);
    const math = await creer(postEvaluations, "/api/evaluations", state.math!, {
      classeId: state.classeId,
      matiereId: state.mathId,
      periodeId: state.periodeId,
      type: "DEVOIR",
      libelle: "Devoir 1",
      date: "2027-10-15",
      noteMax: 20,
      coefficient: 2,
    });
    expect(math.response.status).toBe(201);
    state.evaluationMathId = String(math.json.id);
    const interdit = await call(postEvaluations, "/api/evaluations", {
      method: "POST",
      cookie: state.math,
      body: {
        classeId: state.classeId,
        matiereId: state.frId,
        periodeId: state.periodeId,
        type: "DEVOIR",
        libelle: "Français interdit",
        date: "2027-10-16",
        noteMax: 20,
        coefficient: 1,
      },
    });
    expect(interdit.status).toBe(403);
    const francais = await creer(postEvaluations, "/api/evaluations", state.francais, {
      classeId: state.classeId,
      matiereId: state.frId,
      periodeId: state.periodeId,
      type: "DEVOIR",
      libelle: "Devoir de français",
      date: "2027-10-20",
      noteMax: 20,
      coefficient: 1,
    });
    expect(francais.response.status).toBe(201);
    state.evaluationFrId = String(francais.json.id);
  });

  it("E2E-08 saisit les notes, rejette 21 et interdit l'autre enseignant", async () => {
    const eleves = state.eleves!;
    const ligne = (index: number, valeur: number | null, estAbsent: boolean) => ({
      eleveId: eleves[index].id,
      valeur,
      estAbsent,
    });
    const horsBarreme = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: state.math,
      body: {
        evaluationId: state.evaluationMathId,
        lignes: [ligne(0, 21, false)],
      },
    });
    expect(horsBarreme.status).toBe(422);
    const maths = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: state.math,
      body: {
        evaluationId: state.evaluationMathId,
        lignes: [
          ligne(0, 15, false),
          ligne(1, null, true),
          ...Array.from({ length: 28 }, (_, offset) => ligne(offset + 2, 10, false)),
        ],
      },
    });
    expect(maths.status).toBe(201);
    const francais = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: state.francais,
      body: {
        evaluationId: state.evaluationFrId,
        lignes: [
          ligne(0, 12, false),
          ligne(1, 12, false),
          ...Array.from({ length: 27 }, (_, offset) => ligne(offset + 2, 12, false)),
          ligne(29, 8, false),
        ],
      },
    });
    expect(francais.status).toBe(201);
    const intrusion = await call(postLot, "/api/notes/lot", {
      method: "POST",
      cookie: state.math,
      body: {
        evaluationId: state.evaluationFrId,
        lignes: [ligne(0, 19, false)],
      },
    });
    expect(intrusion.status).toBe(403);
    const corps = await jsonOf(intrusion);
    expect(JSON.stringify(corps)).not.toMatch(/"valeur"\s*:\s*19/);
  });

  it("E2E-09 à E2E-11 calcule moyennes, classement et statistiques", async () => {
    const analyse = await call(
      getAnalyseClasse,
      `/api/analyses/classe?classeId=${state.classeId}&periodeId=${state.periodeId}`,
      { cookie: state.direction },
    );
    expect(analyse.status).toBe(200);
    const corps = await jsonOf(analyse);
    const eleves = corps.eleves as Array<{
      matricule: string;
      moyenneGenerale: number | null;
      rang: number | null;
    }>;
    const parMatricule = new Map(eleves.map((eleve) => [eleve.matricule, eleve]));
    expect(parMatricule.get("MAT-2027-001")).toMatchObject({ moyenneGenerale: 14, rang: 1 });
    expect(parMatricule.get("MAT-2027-002")).toMatchObject({ moyenneGenerale: 12, rang: 2 });
    expect(parMatricule.get("MAT-2027-003")).toMatchObject({ moyenneGenerale: 10.67, rang: 3 });
    expect(parMatricule.get("MAT-2027-029")).toMatchObject({ moyenneGenerale: 10.67, rang: 3 });
    expect(parMatricule.get("MAT-2027-030")).toMatchObject({ moyenneGenerale: 9.33, rang: 30 });
    expect(parMatricule.get("MAT-2027-004")?.rang).toBe(3);

    const stats = corps.statistiques as {
      effectif: number;
      calculables: number;
      moyenneClasse: number;
      mediane: number;
      minimum: number;
      maximum: number;
      tauxReussite: number;
    };
    expect(stats.effectif).toBe(30);
    expect(stats.calculables).toBe(30);
    expect(stats.moyenneClasse).toBe(10.78);
    expect(stats.mediane).toBe(10.67);
    expect(stats.minimum).toBe(9.33);
    expect(stats.maximum).toBe(14);
    expect(stats.tauxReussite).toBe(96.67);

    const matiere = await jsonOf(
      await call(
        getAnalyseMatiere,
        `/api/analyses/matiere?classeId=${state.classeId}&matiereId=${state.mathId}&periodeId=${state.periodeId}`,
        { cookie: state.direction },
      ),
    );
    expect((matiere.statistiques as { absences: number }).absences).toBe(1);

    const eleve = await login("consultation@tilleuls.demo");
    const interdit = await call(
      getAnalyseClasse,
      `/api/analyses/classe?classeId=${state.classeId}`,
      { cookie: state.math },
    );
    expect([200, 403]).toContain(interdit.status);
    if (interdit.status === 200) {
      const reduit = await jsonOf(interdit);
      const premier = (reduit.eleves as Array<{ moyenneGenerale: number | null }>)[0];
      expect(premier.moyenneGenerale).toBeNull();
    }
    expect(eleve).toContain("authjs.session-token");
  });

  it("prouve que /api/health interroge la base", async () => {
    const response = await call(getHealth, "/api/health");
    expect(response.status).toBe(200);
    expect(await jsonOf(response)).toEqual({ status: "ok", database: "ok" });
  });
});

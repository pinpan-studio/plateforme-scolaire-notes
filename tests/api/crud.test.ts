import { describe, expect, it } from "vitest";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { GET as getEleves, POST as postEleves } from "@/app/api/eleves/route";
import { DELETE as deleteEleve, GET as getEleve, PATCH as patchEleve } from "@/app/api/eleves/[id]/route";
import { GET as getClasses, POST as postClasses } from "@/app/api/classes/route";
import { DELETE as deleteClasse } from "@/app/api/classes/[id]/route";
import { POST as postInscription } from "@/app/api/classes/[id]/inscriptions/route";
import { GET as getMatieres, POST as postMatieres } from "@/app/api/matieres/route";
import { DELETE as deleteMatiere, PATCH as patchMatiere } from "@/app/api/matieres/[id]/route";
import { GET as getEnseignants, POST as postEnseignants } from "@/app/api/enseignants/route";
import { POST as postAffectations } from "@/app/api/affectations/route";
import { call, jsonOf, login } from "./helpers";

describe("référentiel", () => {
  it("crée, filtre, modifie et refuse un élève selon les règles", async () => {
    const admin = await login("admin@tilleuls.demo");
    const enseignant = await login("nathan.durand@tilleuls.demo");
    const classes = await jsonOf(await call(getClasses, "/api/classes?pageSize=100", { cookie: admin }));
    const classe = (classes.data as Array<{ id: string; nom: string }>).find((row) => row.nom === "6e A");
    expect(classe).toBeTruthy();

    const vide = await call(postEleves, "/api/eleves", { method: "POST", cookie: admin, body: {} });
    expect(vide.status).toBe(422);
    const issues = await jsonOf(vide);
    const details = (issues.error as { details: Array<{ path: string }> }).details.map((item) => item.path);
    expect(details).toEqual(expect.arrayContaining(["matricule", "nom", "prenom", "classeId"]));

    const invalide = await call(postEleves, "/api/eleves", {
      method: "POST",
      cookie: admin,
      rawBody: "{",
    });
    expect(invalide.status).toBe(400);

    const payload = {
      matricule: "  mat-test-100  ",
      nom: "Diallo",
      prenom: "Awa",
      dateNaissance: "2014-03-12",
      sexe: "F",
      classeId: classe!.id,
    };
    const created = await call(postEleves, "/api/eleves", { method: "POST", cookie: admin, body: payload });
    expect(created.status).toBe(201);
    const eleve = await jsonOf(created);
    expect(eleve.matricule).toBe("MAT-TEST-100");
    expect((eleve.inscription as { classeId: string }).classeId).toBe(classe!.id);

    const relu = await call(getEleve, `/api/eleves/${eleve.id}`, {
      cookie: admin,
      params: { id: String(eleve.id) },
    });
    expect(relu.status).toBe(200);

    const doublon = await call(postEleves, "/api/eleves", { method: "POST", cookie: admin, body: payload });
    expect(doublon.status).toBe(409);

    const court = await call(postEleves, "/api/eleves", {
      method: "POST",
      cookie: admin,
      body: { ...payload, matricule: "A" },
    });
    expect(court.status).toBe(422);

    const strict = await call(postEleves, "/api/eleves", {
      method: "POST",
      cookie: admin,
      body: { ...payload, matricule: "MAT-TEST-101", role: "ADMIN" },
    });
    expect(strict.status).toBe(422);

    const recherche = await call(getEleves, "/api/eleves?q=%20Diallo%20&classeId=" + classe!.id, { cookie: admin });
    expect(recherche.status).toBe(200);
    const trouves = (await jsonOf(recherche)).data as Array<{ matricule: string }>;
    expect(trouves.some((row) => row.matricule === "MAT-TEST-100")).toBe(true);

    const injection = await call(getEleves, "/api/eleves?q=" + encodeURIComponent("' OR 1=1 --"), { cookie: admin });
    expect(injection.status).toBe(200);
    const injectes = (await jsonOf(injection)).data as unknown[];
    expect(injectes.length).toBe(0);

    const tri = await call(getEleves, "/api/eleves?sort=nom;drop%20table%20eleve", { cookie: admin });
    expect(tri.status).toBe(422);

    const tropLong = await call(getEleves, `/api/eleves?q=${"a".repeat(81)}`, { cookie: admin });
    expect(tropLong.status).toBe(422);

    const patch = await call(patchEleve, `/api/eleves/${eleve.id}`, {
      method: "PATCH",
      cookie: admin,
      params: { id: String(eleve.id) },
      body: { prenom: "Awa Marie" },
    });
    expect(patch.status).toBe(200);
    const patched = await jsonOf(patch);
    expect(patched.prenom).toBe("Awa Marie");
    expect(patched.matricule).toBe("MAT-TEST-100");

    const interdit = await call(postEleves, "/api/eleves", {
      method: "POST",
      cookie: enseignant,
      body: { ...payload, matricule: "MAT-TEST-102" },
    });
    expect(interdit.status).toBe(403);

    const inconnuId = "11111111-1111-4111-8111-111111111111";
    const absent = await call(getEleve, `/api/eleves/${inconnuId}`, {
      cookie: admin,
      params: { id: inconnuId },
    });
    expect(absent.status).toBe(404);

    const sansSession = await call(postEleves, "/api/eleves", { method: "POST", body: payload });
    expect(sansSession.status).toBe(401);

    const suppression = await call(deleteEleve, `/api/eleves/${eleve.id}`, {
      method: "DELETE",
      cookie: admin,
      params: { id: String(eleve.id) },
    });
    expect(suppression.status).toBe(204);
  });

  it("gère les classes, les matières et les affectations", async () => {
    const admin = await login("admin@tilleuls.demo");
    const enseignant = await login("nathan.durand@tilleuls.demo");
    const direction = await login("direction@tilleuls.demo");
    const annees = await jsonOf(await call((await import("@/app/api/annees/route")).GET, "/api/annees", { cookie: admin }));
    const annee = (annees as unknown as Array<{ id: string; libelle: string }>).find((row) => row.libelle === "2025-2026");
    const niveaux = await jsonOf(await call((await import("@/app/api/niveaux/route")).GET, "/api/niveaux", { cookie: admin }));
    const niveau = (niveaux as unknown as Array<{ id: string; code: string }>).find((row) => row.code === "3e");

    const classe = await call(postClasses, "/api/classes", {
      method: "POST",
      cookie: admin,
      body: { nom: "3e Z", niveauId: niveau!.id, anneeScolaireId: annee!.id },
    });
    expect(classe.status).toBe(201);
    const classeId = String((await jsonOf(classe)).id);
    const doublon = await call(postClasses, "/api/classes", {
      method: "POST",
      cookie: admin,
      body: { nom: "3e Z", niveauId: niveau!.id, anneeScolaireId: annee!.id },
    });
    expect(doublon.status).toBe(409);
    const vide = await call(postClasses, "/api/classes", {
      method: "POST",
      cookie: admin,
      body: { nom: "   ", niveauId: niveau!.id, anneeScolaireId: annee!.id },
    });
    expect(vide.status).toBe(422);
    const enseignantClasse = await call(postClasses, "/api/classes", {
      method: "POST",
      cookie: enseignant,
      body: { nom: "3e Y", niveauId: niveau!.id, anneeScolaireId: annee!.id },
    });
    expect(enseignantClasse.status).toBe(403);

    const matiere = await call(postMatieres, "/api/matieres", {
      method: "POST",
      cookie: admin,
      body: { code: "lat", nom: "Latin", coefficient: 2 },
    });
    expect(matiere.status).toBe(201);
    const matiereCreee = await jsonOf(matiere);
    const matiereId = String(matiereCreee.id);
    expect(matiereCreee.coefficient).toBe(2);
    const coefNul = await call(postMatieres, "/api/matieres", {
      method: "POST",
      cookie: admin,
      body: { code: "NUL", nom: "Nul", coefficient: 0 },
    });
    expect(coefNul.status).toBe(422);
    const coefChaine = await call(postMatieres, "/api/matieres", {
      method: "POST",
      cookie: admin,
      body: { code: "CH", nom: "Chaine", coefficient: "4" },
    });
    expect(coefChaine.status).toBe(422);
    const codeDoublon = await call(postMatieres, "/api/matieres", {
      method: "POST",
      cookie: admin,
      body: { code: "LAT", nom: "Latin bis", coefficient: 1 },
    });
    expect(codeDoublon.status).toBe(409);
    const directionMatiere = await call(postMatieres, "/api/matieres", {
      method: "POST",
      cookie: direction,
      body: { code: "DIR", nom: "Direction", coefficient: 1 },
    });
    expect(directionMatiere.status).toBe(403);
    const liste = await jsonOf(await call(getMatieres, "/api/matieres", { cookie: admin }));
    const noms = (liste as unknown as Array<{ nom: string }>).map((row) => row.nom);
    expect(noms.indexOf("Français")).toBeLessThan(noms.indexOf("Mathématiques"));

    const enseignants = await jsonOf(await call(getEnseignants, "/api/enseignants?pageSize=100", { cookie: admin }));
    const nathan = (enseignants.data as Array<{ id: string; email: string }>).find((row) => row.email === "nathan.durand@tilleuls.demo");
    const affectation = await call(postAffectations, "/api/affectations", {
      method: "POST",
      cookie: admin,
      body: { enseignantId: nathan!.id, classeId, matiereId },
    });
    expect(affectation.status).toBe(201);
    const auto = await call(postAffectations, "/api/affectations", {
      method: "POST",
      cookie: enseignant,
      body: { enseignantId: nathan!.id, classeId, matiereId },
    });
    expect(auto.status).toBe(403);

    const eleveResponse = await call(postEleves, "/api/eleves", {
      method: "POST",
      cookie: admin,
      body: {
        matricule: "MAT-TEST-200",
        nom: "Test",
        prenom: "Classe",
        dateNaissance: "2012-01-15",
        sexe: "M",
        classeId,
      },
    });
    expect(eleveResponse.status).toBe(201);
    const eleveCree = await jsonOf(eleveResponse);
    const autre = await call(postClasses, "/api/classes", {
      method: "POST",
      cookie: admin,
      body: { nom: "3e W", niveauId: niveau!.id, anneeScolaireId: annee!.id },
    });
    const autreId = String((await jsonOf(autre)).id);
    const deplacement = await call(postInscription, `/api/classes/${autreId}/inscriptions`, {
      method: "POST",
      cookie: admin,
      params: { id: autreId },
      body: { eleveId: eleveCree.id },
    });
    expect(deplacement.status).toBe(201);

    const suppressionClasse = await call(deleteClasse, `/api/classes/${classeId}`, {
      method: "DELETE",
      cookie: admin,
      params: { id: classeId },
    });
    expect(suppressionClasse.status).toBe(409);

    await call(deleteEleve, `/api/eleves/${eleveCree.id}`, {
      method: "DELETE",
      cookie: admin,
      params: { id: String(eleveCree.id) },
    });
    const affectationId = String((await jsonOf(affectation)).id);
    await call((await import("@/app/api/affectations/[id]/route")).DELETE, `/api/affectations/${affectationId}`, {
      method: "DELETE",
      cookie: admin,
      params: { id: affectationId },
    });
    const sansDependance = await call(deleteClasse, `/api/classes/${classeId}`, {
      method: "DELETE",
      cookie: admin,
      params: { id: classeId },
    });
    expect(sansDependance.status).toBe(204);
    await call(deleteClasse, `/api/classes/${autreId}`, {
      method: "DELETE",
      cookie: admin,
      params: { id: autreId },
    });
    const maj = await call(patchMatiere, `/api/matieres/${matiereId}`, {
      method: "PATCH",
      cookie: admin,
      params: { id: matiereId },
      body: { coefficient: 3 },
    });
    expect(maj.status).toBe(200);
    await call(deleteMatiere, `/api/matieres/${matiereId}`, {
      method: "DELETE",
      cookie: admin,
      params: { id: matiereId },
    });
    const math = (liste as unknown as Array<{ code: string; id: string }>).find((row) => row.code === "MATH");
    const bloquee = await call(deleteMatiere, `/api/matieres/${math!.id}`, {
      method: "DELETE",
      cookie: admin,
      params: { id: math!.id },
    });
    expect(bloquee.status).toBe(409);
    void loginRoute;
    void postEnseignants;
  });
});

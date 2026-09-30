import { describe, expect, it } from "vitest";
import { GET as getAnnees, POST as postAnnees } from "@/app/api/annees/route";
import { PATCH as patchAnnee } from "@/app/api/annees/[id]/route";
import { GET as getAudit } from "@/app/api/audit/route";
import { GET as getSession } from "@/app/api/auth/session/route";
import { GET as getClasses } from "@/app/api/classes/route";
import { POST as postAffectations } from "@/app/api/affectations/route";
import { DELETE as deleteAffectation } from "@/app/api/affectations/[id]/route";
import { GET as getEleves, POST as postEleves } from "@/app/api/eleves/route";
import { DELETE as deleteEleve, GET as getEleve, PATCH as patchEleve } from "@/app/api/eleves/[id]/route";
import { POST as postEvaluations } from "@/app/api/evaluations/route";
import { DELETE as deleteEvaluation, GET as getEvaluation, PATCH as patchEvaluation } from "@/app/api/evaluations/[id]/route";
import { POST as postMatieres } from "@/app/api/matieres/route";
import { DELETE as deleteMatiere, PATCH as patchMatiere } from "@/app/api/matieres/[id]/route";
import { POST as postNotes } from "@/app/api/notes/route";
import { DELETE as deleteNote } from "@/app/api/notes/[id]/route";
import { GET as getPeriodes } from "@/app/api/periodes/route";
import { PATCH as patchProfil } from "@/app/api/profil/mot-de-passe/route";
import { POST as postUtilisateurs } from "@/app/api/utilisateurs/route";
import { PATCH as patchUtilisateur } from "@/app/api/utilisateurs/[id]/route";
import { POST as postMotDePasseTemporaire } from "@/app/api/utilisateurs/[id]/mot-de-passe-temporaire/route";
import { call, jsonOf, login } from "./helpers";

const MOT_DE_PASSE_A = "Audit-Test-2026!";
const MOT_DE_PASSE_B = "Audit-Test-2027!";
const MOT_DE_PASSE_C = "Audit-Test-2028!";

type LigneAudit = {
  type: string;
  acteurId: string | null;
  identifiant: string | null;
  resultat: string;
  action: string | null;
  cibleType: string | null;
  cibleId: string | null;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  createdAt: string;
};

type Erreur = { error?: { code?: string; message?: string } };

async function audits(cookie: string) {
  const response = await call(getAudit, "/api/audit", { cookie });
  expect(response.status).toBe(200);
  return (await jsonOf(response)) as unknown as LigneAudit[];
}

function derniere(lignes: LigneAudit[], type: string, cibleId: string) {
  return lignes.find((ligne) => ligne.type === type && ligne.cibleId === cibleId);
}

function assertTrace(ligne: LigneAudit | undefined, attendu: Partial<LigneAudit>) {
  expect(ligne).toBeTruthy();
  expect(ligne).toMatchObject(attendu);
  expect(Date.parse(ligne!.createdAt)).not.toBeNaN();
  expect(Math.abs(Date.now() - Date.parse(ligne!.createdAt))).toBeLessThan(2 * 60 * 1000);
}

function sansSecret(lignes: LigneAudit[], ...interdits: string[]) {
  const texte = JSON.stringify(lignes);
  for (const interdit of interdits) {
    expect(texte).not.toContain(interdit);
  }
  expect(texte).not.toMatch(/\$2[aby]\$|motDePasseHash|eyJ[A-Za-z0-9_-]{8,}\./);
}

describe("réouverture d'année, notes existantes et audit", () => {
  it("réserve la réouverture d'une année clôturée à l'admin et l'audite", async () => {
    const admin = await login("admin@tilleuls.demo");
    const direction = await login("direction@tilleuls.demo");
    const enseignant = await login("nathan.durand@tilleuls.demo");
    const session = (await jsonOf(await call(getSession, "/api/auth/session", { cookie: admin }))).utilisateur as {
      id: string;
      email: string;
      role: string;
    };
    expect(session.role).toBe("ADMIN");

    const annees = (await jsonOf(await call(getAnnees, "/api/annees", { cookie: admin }))) as unknown as Array<{
      id: string;
      libelle: string;
      statut: string;
    }>;
    const close = annees.find((annee) => annee.libelle === "2024-2025");
    expect(close?.statut).toBe("CLOTUREE");
    const id = close!.id;
    const avant = (await audits(admin)).filter((ligne) => ligne.type === "ANNEE_STATUT" && ligne.cibleId === id).length;

    const directionTente = await call(patchAnnee, `/api/annees/${id}`, {
      method: "PATCH",
      cookie: direction,
      params: { id },
      body: { statut: "PREPARATION" },
    });
    expect(directionTente.status).toBe(403);
    expect(((await jsonOf(directionTente)) as Erreur).error?.code).toBe("FORBIDDEN");

    const roleDansLeCorps = await call(patchAnnee, `/api/annees/${id}`, {
      method: "PATCH",
      cookie: direction,
      params: { id },
      headers: { "x-role": "ADMIN" },
      body: { statut: "PREPARATION", role: "ADMIN" },
    });
    expect(roleDansLeCorps.status).toBe(422);

    const enseignantTente = await call(patchAnnee, `/api/annees/${id}`, {
      method: "PATCH",
      cookie: enseignant,
      params: { id },
      body: { statut: "EN_COURS" },
    });
    expect(enseignantTente.status).toBe(403);

    const sessionDirection = (await jsonOf(await call(getSession, "/api/auth/session", { cookie: direction })))
      .utilisateur as { role: string };
    expect(sessionDirection.role).toBe("DIRECTION");

    const toujoursClose = (await jsonOf(await call(getAnnees, "/api/annees", { cookie: admin }))) as unknown as Array<{
      id: string;
      statut: string;
    }>;
    expect(toujoursClose.find((annee) => annee.id === id)?.statut).toBe("CLOTUREE");
    expect((await audits(admin)).filter((ligne) => ligne.type === "ANNEE_STATUT" && ligne.cibleId === id)).toHaveLength(
      avant,
    );

    const deuxiemeOuverte = await call(patchAnnee, `/api/annees/${id}`, {
      method: "PATCH",
      cookie: admin,
      params: { id },
      body: { statut: "EN_COURS" },
    });
    expect(deuxiemeOuverte.status).toBe(409);
    expect(((await jsonOf(deuxiemeOuverte)) as Erreur).error?.code).toBe("CONFLIT");

    const rouverte = await call(patchAnnee, `/api/annees/${id}`, {
      method: "PATCH",
      cookie: admin,
      params: { id },
      body: { statut: "PREPARATION" },
    });
    expect(rouverte.status).toBe(200);
    expect((await jsonOf(rouverte)).statut).toBe("PREPARATION");
    const traceReouverture = derniere(await audits(admin), "ANNEE_STATUT", id);
    assertTrace(traceReouverture, {
      acteurId: session.id,
      identifiant: session.email,
      resultat: "200",
      action: "PATCH",
      cibleType: "annee_scolaire",
      ancienneValeur: "CLOTUREE",
      nouvelleValeur: "PREPARATION",
    });

    const clotureDirection = await call(patchAnnee, `/api/annees/${id}`, {
      method: "PATCH",
      cookie: direction,
      params: { id },
      body: { statut: "CLOTUREE" },
    });
    expect(clotureDirection.status).toBe(200);
    const sessionDirectionId = (
      (await jsonOf(await call(getSession, "/api/auth/session", { cookie: direction }))).utilisateur as { id: string }
    ).id;
    assertTrace(derniere(await audits(admin), "ANNEE_STATUT", id), {
      acteurId: sessionDirectionId,
      identifiant: "direction@tilleuls.demo",
      action: "PATCH",
      ancienneValeur: "PREPARATION",
      nouvelleValeur: "CLOTUREE",
    });

    const creation = await call(postAnnees, "/api/annees", {
      method: "POST",
      cookie: admin,
      body: { libelle: "2098-2099", dateDebut: "2098-09-01", dateFin: "2099-07-01" },
    });
    expect(creation.status).toBe(201);
    const anneeCreee = await jsonOf(creation);
    assertTrace(derniere(await audits(admin), "ANNEE_STATUT", String(anneeCreee.id)), {
      acteurId: session.id,
      resultat: "201",
      action: "POST",
      cibleType: "annee_scolaire",
      nouvelleValeur: "PREPARATION",
    });
  });

  it("refuse de déplacer un élève qui a des notes et accepte un élève sans note", async () => {
    const admin = await login("admin@tilleuls.demo");
    const classes = (
      (await jsonOf(await call(getClasses, "/api/classes?pageSize=100", { cookie: admin }))).data as Array<{
        id: string;
        nom: string;
      }>
    );
    const sixieme = classes.find((classe) => classe.nom === "6e A");
    const cinquieme = classes.find((classe) => classe.nom === "5e A");
    expect(sixieme && cinquieme).toBeTruthy();

    const eleves = (
      (await jsonOf(await call(getEleves, `/api/eleves?classeId=${sixieme!.id}&pageSize=5`, { cookie: admin })))
        .data as Array<{ id: string; prenom: string; inscription: { classeId: string } | null }>
    );
    const note = eleves[0];
    expect(note?.inscription?.classeId).toBe(sixieme!.id);

    const deplacement = await call(patchEleve, `/api/eleves/${note.id}`, {
      method: "PATCH",
      cookie: admin,
      params: { id: note.id },
      body: { classeId: cinquieme!.id },
    });
    expect(deplacement.status).toBe(409);
    expect(((await jsonOf(deplacement)) as Erreur).error?.code).toBe("CONFLIT");
    const relu = await jsonOf(
      await call(getEleve, `/api/eleves/${note.id}`, { cookie: admin, params: { id: note.id } }),
    );
    expect((relu.inscription as { classeId: string }).classeId).toBe(sixieme!.id);

    const memeClasse = await call(patchEleve, `/api/eleves/${note.id}`, {
      method: "PATCH",
      cookie: admin,
      params: { id: note.id },
      body: { classeId: sixieme!.id, prenom: note.prenom },
    });
    expect(memeClasse.status).toBe(200);

    const cree = await call(postEleves, "/api/eleves", {
      method: "POST",
      cookie: admin,
      body: {
        matricule: "SEC-009-ELEVE",
        nom: "Sansnote",
        prenom: "Léa",
        dateNaissance: "2014-04-02",
        sexe: "F",
        classeId: sixieme!.id,
      },
    });
    expect(cree.status).toBe(201);
    const eleveId = String((await jsonOf(cree)).id);
    try {
      const versCinquieme = await call(patchEleve, `/api/eleves/${eleveId}`, {
        method: "PATCH",
        cookie: admin,
        params: { id: eleveId },
        body: { classeId: cinquieme!.id },
      });
      expect(versCinquieme.status).toBe(200);
      expect(((await jsonOf(versCinquieme)).inscription as { classeId: string }).classeId).toBe(cinquieme!.id);
    } finally {
      const suppression = await call(deleteEleve, `/api/eleves/${eleveId}`, {
        method: "DELETE",
        cookie: admin,
        params: { id: eleveId },
      });
      expect(suppression.status).toBe(204);
    }
  });

  it("refuse de changer noteMax tant que des notes existent et audite le barème légitime", async () => {
    const admin = await login("admin@tilleuls.demo");
    const session = (await jsonOf(await call(getSession, "/api/auth/session", { cookie: admin }))).utilisateur as {
      id: string;
    };
    const comptes = (await jsonOf(
      await call((await import("@/app/api/utilisateurs/route")).GET, "/api/utilisateurs", { cookie: admin }),
    )) as unknown as Array<{ email: string; enseignantId: string | null }>;
    const nathan = comptes.find((compte) => compte.email === "nathan.durand@tilleuls.demo");
    expect(nathan?.enseignantId).toBeTruthy();

    const classes = (
      (await jsonOf(await call(getClasses, "/api/classes?pageSize=100", { cookie: admin }))).data as Array<{
        id: string;
        nom: string;
        anneeScolaireId: string;
      }>
    );
    const sixieme = classes.find((classe) => classe.nom === "6e A")!;
    const periodes = (await jsonOf(
      await call(getPeriodes, `/api/periodes?anneeScolaireId=${sixieme.anneeScolaireId}`, { cookie: admin }),
    )) as unknown as Array<{ id: string; dateDebut: string }>;
    const periode = periodes[0];
    const eleves = (
      (await jsonOf(await call(getEleves, `/api/eleves?classeId=${sixieme.id}&pageSize=1`, { cookie: admin })))
        .data as Array<{ id: string }>
    );

    const matiere = await call(postMatieres, "/api/matieres", {
      method: "POST",
      cookie: admin,
      body: { code: "AUD", nom: "Audit barème", coefficient: 1 },
    });
    expect(matiere.status).toBe(201);
    const matiereId = String((await jsonOf(matiere)).id);
    let affectationId: string | undefined;
    let evaluationId: string | undefined;
    let noteId: string | undefined;
    try {
      const coefficient = await call(patchMatiere, `/api/matieres/${matiereId}`, {
        method: "PATCH",
        cookie: admin,
        params: { id: matiereId },
        body: { coefficient: 3 },
      });
      expect(coefficient.status).toBe(200);
      const traceMatiere = derniere(await audits(admin), "BAREME_MODIFICATION", matiereId);
      assertTrace(traceMatiere, {
        acteurId: session.id,
        action: "PATCH",
        cibleType: "matiere",
        ancienneValeur: JSON.stringify({ coefficient: 1 }),
        nouvelleValeur: JSON.stringify({ coefficient: 3 }),
      });

      const affectation = await call(postAffectations, "/api/affectations", {
        method: "POST",
        cookie: admin,
        body: { enseignantId: nathan!.enseignantId, classeId: sixieme.id, matiereId },
      });
      expect(affectation.status).toBe(201);
      affectationId = String((await jsonOf(affectation)).id);
      assertTrace(derniere(await audits(admin), "AFFECTATION_CREATION", affectationId), {
        acteurId: session.id,
        resultat: "201",
        action: "POST",
        cibleType: "affectation",
      });

      const evaluation = await call(postEvaluations, "/api/evaluations", {
        method: "POST",
        cookie: admin,
        body: {
          classeId: sixieme.id,
          matiereId,
          periodeId: periode.id,
          enseignantId: nathan!.enseignantId,
          type: "DEVOIR",
          libelle: "Contrôle audit",
          date: periode.dateDebut,
          noteMax: 20,
          coefficient: 1,
        },
      });
      expect(evaluation.status).toBe(201);
      evaluationId = String((await jsonOf(evaluation)).id);

      const noteMax = await call(patchEvaluation, `/api/evaluations/${evaluationId}`, {
        method: "PATCH",
        cookie: admin,
        params: { id: evaluationId },
        body: { noteMax: 10 },
      });
      expect(noteMax.status).toBe(200);
      assertTrace(derniere(await audits(admin), "BAREME_MODIFICATION", evaluationId), {
        acteurId: session.id,
        cibleType: "evaluation",
        ancienneValeur: JSON.stringify({ noteMax: 20 }),
        nouvelleValeur: JSON.stringify({ noteMax: 10 }),
      });

      const note = await call(postNotes, "/api/notes", {
        method: "POST",
        cookie: admin,
        body: { evaluationId, eleveId: eleves[0].id, valeur: 8, estAbsent: false },
      });
      expect(note.status).toBe(201);
      noteId = String((await jsonOf(note)).id);

      const refuse = await call(patchEvaluation, `/api/evaluations/${evaluationId}`, {
        method: "PATCH",
        cookie: admin,
        params: { id: evaluationId },
        body: { noteMax: 12 },
      });
      expect(refuse.status).toBe(409);
      expect(((await jsonOf(refuse)) as Erreur).error?.code).toBe("CONFLIT");
      const fiche = await jsonOf(
        await call(getEvaluation, `/api/evaluations/${evaluationId}`, {
          cookie: admin,
          params: { id: evaluationId },
        }),
      );
      expect(fiche.noteMax).toBe(10);

      const identique = await call(patchEvaluation, `/api/evaluations/${evaluationId}`, {
        method: "PATCH",
        cookie: admin,
        params: { id: evaluationId },
        body: { noteMax: 10, libelle: "Contrôle audit relu" },
      });
      expect(identique.status).toBe(200);
      expect((await jsonOf(identique)).noteMax).toBe(10);

      const avantCoefficient = (await audits(admin)).filter(
        (ligne) => ligne.type === "BAREME_MODIFICATION" && ligne.cibleId === evaluationId,
      ).length;
      const coefficientEvaluation = await call(patchEvaluation, `/api/evaluations/${evaluationId}`, {
        method: "PATCH",
        cookie: admin,
        params: { id: evaluationId },
        body: { coefficient: 2 },
      });
      expect(coefficientEvaluation.status).toBe(200);
      const traces = (await audits(admin)).filter(
        (ligne) => ligne.type === "BAREME_MODIFICATION" && ligne.cibleId === evaluationId,
      );
      expect(traces).toHaveLength(avantCoefficient + 1);
      assertTrace(traces[0], {
        ancienneValeur: JSON.stringify({ coefficient: 1 }),
        nouvelleValeur: JSON.stringify({ coefficient: 2 }),
      });
    } finally {
      if (noteId) {
        await call(deleteNote, `/api/notes/${noteId}`, { method: "DELETE", cookie: admin, params: { id: noteId } });
      }
      if (evaluationId) {
        await call(deleteEvaluation, `/api/evaluations/${evaluationId}`, {
          method: "DELETE",
          cookie: admin,
          params: { id: evaluationId },
        });
      }
      if (affectationId) {
        const suppression = await call(deleteAffectation, `/api/affectations/${affectationId}`, {
          method: "DELETE",
          cookie: admin,
          params: { id: affectationId },
        });
        expect(suppression.status).toBe(204);
        assertTrace(derniere(await audits(admin), "AFFECTATION_SUPPRESSION", affectationId), {
          acteurId: session.id,
          resultat: "204",
          action: "DELETE",
          cibleType: "affectation",
        });
      }
      await call(deleteMatiere, `/api/matieres/${matiereId}`, {
        method: "DELETE",
        cookie: admin,
        params: { id: matiereId },
      });
    }
  });

  it("audite création, rôle, activation et réinitialisation sans secret", async () => {
    const admin = await login("admin@tilleuls.demo");
    const session = (await jsonOf(await call(getSession, "/api/auth/session", { cookie: admin }))).utilisateur as {
      id: string;
      email: string;
    };
    const creation = await call(postUtilisateurs, "/api/utilisateurs", {
      method: "POST",
      cookie: admin,
      body: {
        email: "audit.sec.3dc1@tilleuls.demo",
        motDePasse: MOT_DE_PASSE_A,
        roleCode: "CONSULTATION",
        prenom: "Audit",
        nom: "Métier",
      },
    });
    expect(creation.status).toBe(201);
    const compte = await jsonOf(creation);
    const id = String(compte.id);
    expect(JSON.stringify(compte)).not.toContain(MOT_DE_PASSE_A);
    assertTrace(derniere(await audits(admin), "UTILISATEUR_CREATION", id), {
      acteurId: session.id,
      identifiant: session.email,
      resultat: "201",
      action: "POST",
      cibleType: "utilisateur",
      nouvelleValeur: JSON.stringify({ email: "audit.sec.3dc1@tilleuls.demo", role: "CONSULTATION", actif: true }),
    });
    sansSecret(await audits(admin), MOT_DE_PASSE_A);

    const role = await call(patchUtilisateur, `/api/utilisateurs/${id}`, {
      method: "PATCH",
      cookie: admin,
      params: { id },
      body: { roleCode: "DIRECTION" },
    });
    expect(role.status).toBe(200);
    assertTrace(derniere(await audits(admin), "UTILISATEUR_MODIFICATION", id), {
      acteurId: session.id,
      action: "PATCH",
      ancienneValeur: JSON.stringify({ role: "CONSULTATION", actif: true }),
      nouvelleValeur: JSON.stringify({ role: "DIRECTION", actif: true }),
    });

    const avantPrenom = (await audits(admin)).filter(
      (ligne) => ligne.type === "UTILISATEUR_MODIFICATION" && ligne.cibleId === id,
    ).length;
    const prenom = await call(patchUtilisateur, `/api/utilisateurs/${id}`, {
      method: "PATCH",
      cookie: admin,
      params: { id },
      body: { prenom: "Auditrice" },
    });
    expect(prenom.status).toBe(200);
    expect(
      (await audits(admin)).filter((ligne) => ligne.type === "UTILISATEUR_MODIFICATION" && ligne.cibleId === id),
    ).toHaveLength(avantPrenom);

    const motDePasse = await call(patchUtilisateur, `/api/utilisateurs/${id}`, {
      method: "PATCH",
      cookie: admin,
      params: { id },
      body: { motDePasseActuel: MOT_DE_PASSE_A, motDePasse: MOT_DE_PASSE_B },
    });
    expect(motDePasse.status).toBe(200);
    assertTrace(derniere(await audits(admin), "MOT_DE_PASSE", id), {
      acteurId: session.id,
      action: "PATCH",
      ancienneValeur: "defini",
      nouvelleValeur: "reinitialise",
    });
    sansSecret(await audits(admin), MOT_DE_PASSE_A, MOT_DE_PASSE_B);

    const cookieCompte = await login("audit.sec.3dc1@tilleuls.demo", MOT_DE_PASSE_B);
    const profil = await call(patchProfil, "/api/profil/mot-de-passe", {
      method: "PATCH",
      cookie: cookieCompte,
      body: { motDePasseActuel: MOT_DE_PASSE_B, motDePasse: MOT_DE_PASSE_C },
    });
    expect(profil.status).toBe(200);
    assertTrace(derniere(await audits(admin), "MOT_DE_PASSE", id), {
      acteurId: id,
      identifiant: "audit.sec.3dc1@tilleuls.demo",
      action: "PATCH",
      ancienneValeur: "defini",
      nouvelleValeur: "reinitialise",
    });
    sansSecret(await audits(admin), MOT_DE_PASSE_B, MOT_DE_PASSE_C);

    const temporaire = await call(postMotDePasseTemporaire, `/api/utilisateurs/${id}/mot-de-passe-temporaire`, {
      method: "POST",
      cookie: admin,
      params: { id },
    });
    expect(temporaire.status).toBe(200);
    const secret = String((await jsonOf(temporaire)).motDePasseTemporaire);
    expect(secret.startsWith("Tmp-")).toBe(true);
    assertTrace(derniere(await audits(admin), "MOT_DE_PASSE", id), {
      acteurId: session.id,
      action: "POST",
      ancienneValeur: "defini",
      nouvelleValeur: "reinitialise",
    });
    sansSecret(await audits(admin), secret, MOT_DE_PASSE_C);

    const desactivation = await call(patchUtilisateur, `/api/utilisateurs/${id}`, {
      method: "PATCH",
      cookie: admin,
      params: { id },
      body: { actif: false },
    });
    expect(desactivation.status).toBe(200);
    assertTrace(derniere(await audits(admin), "UTILISATEUR_MODIFICATION", id), {
      acteurId: session.id,
      ancienneValeur: JSON.stringify({ role: "DIRECTION", actif: true }),
      nouvelleValeur: JSON.stringify({ role: "DIRECTION", actif: false }),
    });
  });
});

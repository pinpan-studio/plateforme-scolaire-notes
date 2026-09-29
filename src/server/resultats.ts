import { and, asc, eq } from "drizzle-orm";
import {
  affectationEnseignant,
  anneeScolaire,
  classe,
  eleve,
  evaluation,
  inscription,
  matiere,
  note,
  periode,
} from "@/db/schema";
import {
  appreciationPourMoyenne,
  classer,
  moyenneGenerale,
  moyenneMatiere,
  roundHalfUp,
  type NoteSaisie,
} from "@/lib/grading";
import { canReadEstablishmentDashboard, type SessionUser } from "@/lib/auth/permissions";
import { getDb } from "./db";
import { forbidden, notFound } from "./errors";
import { optionalUuid, requireUuid, searchParams } from "./query";
import { canReadClass, canReadClassSubject, loadScope, refuse, subjectIdsForClass } from "./scope";

type GradeRow = {
  eleveId: string;
  matiereId: string;
  matiereNom: string;
  matiereCode: string;
  coefficientMatiere: number;
  valeur: number | null;
  estAbsent: boolean;
  noteMax: number;
  coefficientEvaluation: number;
  periodeId: string;
  periodeOrdre: number;
  periodeLibelle: string;
};

type Inscrit = { eleveId: string; nom: string; prenom: string; matricule: string };

function toSaisies(rows: GradeRow[]): NoteSaisie[] {
  return rows.map((row) => ({
    valeur: row.valeur,
    absent: row.estAbsent,
    noteMax: row.noteMax,
    coefficient: row.coefficientEvaluation,
  }));
}

async function inscritsDeClasse(classeId: string): Promise<Inscrit[]> {
  return getDb()
    .select({
      eleveId: inscription.eleveId,
      nom: eleve.nom,
      prenom: eleve.prenom,
      matricule: eleve.matricule,
    })
    .from(inscription)
    .innerJoin(eleve, eq(inscription.eleveId, eleve.id))
    .where(and(eq(inscription.classeId, classeId), eq(inscription.statut, "INSCRIT")))
    .orderBy(asc(eleve.nom), asc(eleve.prenom));
}

async function matieresDeClasse(classeId: string) {
  return getDb()
    .select({
      matiereId: matiere.id,
      nom: matiere.nom,
      code: matiere.code,
      coefficient: matiere.coefficient,
    })
    .from(affectationEnseignant)
    .innerJoin(matiere, eq(affectationEnseignant.matiereId, matiere.id))
    .where(eq(affectationEnseignant.classeId, classeId))
    .orderBy(asc(matiere.nom));
}

async function notesDeClasse(classeId: string, filtre: { periodeId?: string; matiereId?: string }) {
  const filters = [eq(evaluation.classeId, classeId)];
  if (filtre.periodeId) filters.push(eq(evaluation.periodeId, filtre.periodeId));
  if (filtre.matiereId) filters.push(eq(evaluation.matiereId, filtre.matiereId));
  return getDb()
    .select({
      eleveId: note.eleveId,
      matiereId: matiere.id,
      matiereNom: matiere.nom,
      matiereCode: matiere.code,
      coefficientMatiere: matiere.coefficient,
      valeur: note.valeur,
      estAbsent: note.estAbsent,
      noteMax: evaluation.noteMax,
      coefficientEvaluation: evaluation.coefficient,
      periodeId: evaluation.periodeId,
      periodeOrdre: periode.ordre,
      periodeLibelle: periode.libelle,
    })
    .from(note)
    .innerJoin(evaluation, eq(note.evaluationId, evaluation.id))
    .innerJoin(matiere, eq(evaluation.matiereId, matiere.id))
    .innerJoin(periode, eq(evaluation.periodeId, periode.id))
    .where(and(...filters));
}

function ligneMatiere(subject: { matiereId: string; nom: string; code: string; coefficient: number }, rows: GradeRow[]) {
  const moyenne = moyenneMatiere(toSaisies(rows));
  return {
    matiereId: subject.matiereId,
    code: subject.code,
    nom: subject.nom,
    coefficient: subject.coefficient,
    moyenne,
    appreciation: appreciationPourMoyenne(moyenne),
  };
}

function syntheseClasse(students: Inscrit[], subjects: Array<{ matiereId: string; nom: string; code: string; coefficient: number }>, rows: GradeRow[]) {
  const lignes = students.map((student) => {
    const matieres = subjects.map((subject) =>
      ligneMatiere(
        subject,
        rows.filter((row) => row.eleveId === student.eleveId && row.matiereId === subject.matiereId),
      ),
    );
    const generale = moyenneGenerale(
      matieres.map((item) => ({
        matiereId: item.matiereId,
        coefficient: item.coefficient,
        moyenne: item.moyenne,
      })),
    );
    return {
      ...student,
      matieres,
      moyenneGenerale: generale,
      appreciation: appreciationPourMoyenne(generale),
    };
  });
  const rangs = classer(lignes.map((ligne) => ({ eleveId: ligne.eleveId, moyenne: ligne.moyenneGenerale })));
  return lignes
    .map((ligne) => ({ ...ligne, rang: rangs.get(ligne.eleveId) ?? null }))
    .sort((a, b) => {
      if (a.rang === null && b.rang === null) return a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr");
      if (a.rang === null) return 1;
      if (b.rang === null) return -1;
      return a.rang - b.rang || a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr");
    });
}

function statistiques(lignes: Array<{ moyenneGenerale: number | null }>) {
  const valeurs = lignes.map((ligne) => ligne.moyenneGenerale).filter((valeur): valeur is number => valeur !== null);
  const moyenneClasse = valeurs.length === 0 ? null : roundHalfUp(valeurs.reduce((sum, valeur) => sum + valeur, 0) / valeurs.length);
  const sous10 = valeurs.filter((valeur) => valeur < 10).length;
  const tranches = [
    { min: 0, max: 10, effectif: valeurs.filter((valeur) => valeur >= 0 && valeur < 10).length },
    { min: 10, max: 12, effectif: valeurs.filter((valeur) => valeur >= 10 && valeur < 12).length },
    { min: 12, max: 14, effectif: valeurs.filter((valeur) => valeur >= 12 && valeur < 14).length },
    { min: 14, max: 16, effectif: valeurs.filter((valeur) => valeur >= 14 && valeur < 16).length },
    { min: 16, max: 20, effectif: valeurs.filter((valeur) => valeur >= 16 && valeur <= 20).length },
  ];
  return {
    effectif: lignes.length,
    calculables: valeurs.length,
    moyenneClasse,
    minimum: valeurs.length ? Math.min(...valeurs) : null,
    maximum: valeurs.length ? Math.max(...valeurs) : null,
    partSous10: valeurs.length === 0 ? null : roundHalfUp((sous10 / valeurs.length) * 100),
    tranches,
  };
}

async function assertClasseLisible(session: SessionUser, classeId: string, matiereId?: string) {
  const scope = await loadScope(session);
  const [row] = await getDb()
    .select({ id: classe.id, nom: classe.nom, anneeScolaireId: classe.anneeScolaireId })
    .from(classe)
    .where(eq(classe.id, classeId))
    .limit(1);
  if (!row) throw notFound("Classe introuvable.");
  if (matiereId) {
    if (!canReadClassSubject(scope, classeId, matiereId)) {
      return refuse(session, "GET", "analyse", classeId, "Cette matière est hors de votre périmètre.");
    }
  } else if (!canReadClass(scope, classeId)) {
    return refuse(session, "GET", "analyse", classeId, "Cette classe est hors de votre périmètre.");
  }
  return { scope, classe: row };
}

export async function bulletin(session: SessionUser, request: Request) {
  const params = searchParams(request);
  const eleveId = requireUuid(params, "eleveId");
  const periodeId = optionalUuid(params, "periodeId");
  const db = getDb();
  const [student] = await db
    .select({
      eleveId: eleve.id,
      nom: eleve.nom,
      prenom: eleve.prenom,
      matricule: eleve.matricule,
      classeId: inscription.classeId,
      classeNom: classe.nom,
      anneeScolaireId: inscription.anneeScolaireId,
    })
    .from(eleve)
    .innerJoin(inscription, eq(inscription.eleveId, eleve.id))
    .innerJoin(classe, eq(inscription.classeId, classe.id))
    .where(and(eq(eleve.id, eleveId), eq(inscription.statut, "INSCRIT")))
    .limit(1);
  if (!student) throw notFound("Élève introuvable.");
  const { scope } = await assertClasseLisible(session, student.classeId);
  const subjectsAll = await matieresDeClasse(student.classeId);
  const allowed = subjectIdsForClass(scope, student.classeId);
  const subjects = allowed ? subjectsAll.filter((subject) => allowed.includes(subject.matiereId)) : subjectsAll;
  if (subjects.length === 0) {
    return refuse(session, "GET", "bulletin", eleveId, "Ce bulletin est hors de votre périmètre.");
  }
  const rows = await notesDeClasse(student.classeId, { periodeId });
  const complet = allowed === null;
  const lignes = syntheseClasse([student], complet ? subjectsAll : subjects, rows);
  const ligne = lignes[0];
  let periodeInfo: { id: string | null; libelle: string } = { id: null, libelle: "Année" };
  if (periodeId) {
    const [periodeRow] = await db.select().from(periode).where(eq(periode.id, periodeId)).limit(1);
    if (!periodeRow) throw notFound("Période introuvable.");
    periodeInfo = { id: periodeRow.id, libelle: periodeRow.libelle };
  }
  return {
    eleve: { id: student.eleveId, matricule: student.matricule, nom: student.nom, prenom: student.prenom },
    classe: { id: student.classeId, nom: student.classeNom },
    periode: periodeInfo,
    lignes: (ligne?.matieres ?? []).filter((item) => !allowed || allowed.includes(item.matiereId)),
    moyenneGenerale: complet ? (ligne?.moyenneGenerale ?? null) : null,
    appreciation: complet ? (ligne?.appreciation ?? "Non noté") : null,
    rang: complet ? (ligne?.rang ?? null) : null,
    effectif: complet ? (await inscritsDeClasse(student.classeId)).length : null,
  };
}

export async function analyseEleve(session: SessionUser, request: Request) {
  return bulletin(session, request);
}

export async function analyseClasse(session: SessionUser, request: Request) {
  const params = searchParams(request);
  const classeId = requireUuid(params, "classeId");
  const periodeId = optionalUuid(params, "periodeId");
  const matiereId = optionalUuid(params, "matiereId");
  const { scope, classe: classeRow } = await assertClasseLisible(session, classeId, matiereId);
  const subjectsAll = await matieresDeClasse(classeId);
  const allowed = matiereId ? [matiereId] : subjectIdsForClass(scope, classeId);
  const subjects = allowed ? subjectsAll.filter((subject) => allowed.includes(subject.matiereId)) : subjectsAll;
  const students = await inscritsDeClasse(classeId);
  const rows = await notesDeClasse(classeId, { periodeId, matiereId });
  const lignes = syntheseClasse(students, subjects, rows);
  const complet = allowed === null;
  return {
    classe: classeRow,
    periodeId: periodeId ?? null,
    eleves: lignes.map((ligne) => ({
      ...ligne,
      moyenneGenerale: complet ? ligne.moyenneGenerale : null,
      appreciation: complet ? ligne.appreciation : null,
      rang: complet ? ligne.rang : null,
    })),
    statistiques: complet ? statistiques(lignes) : statistiques(lignes.map((ligne) => ({
      moyenneGenerale: ligne.matieres.length === 1 ? ligne.matieres[0].moyenne : ligne.moyenneGenerale,
    }))),
  };
}

export async function analyseMatiere(session: SessionUser, request: Request) {
  const params = searchParams(request);
  const classeId = requireUuid(params, "classeId");
  const matiereId = requireUuid(params, "matiereId");
  const periodeId = optionalUuid(params, "periodeId");
  await assertClasseLisible(session, classeId, matiereId);
  const subjects = (await matieresDeClasse(classeId)).filter((subject) => subject.matiereId === matiereId);
  if (subjects.length === 0) throw notFound("Matière introuvable dans cette classe.");
  const students = await inscritsDeClasse(classeId);
  const rows = await notesDeClasse(classeId, { periodeId, matiereId });
  const lignes = syntheseClasse(students, subjects, rows);
  const moyennes = lignes.map((ligne) => ligne.matieres[0]?.moyenne ?? null);
  const presentes = rows.filter((row) => !row.estAbsent).length;
  const absences = rows.filter((row) => row.estAbsent).length;
  return {
    classeId,
    matiere: subjects[0],
    periodeId: periodeId ?? null,
    eleves: lignes.map((ligne) => ({
      eleveId: ligne.eleveId,
      nom: ligne.nom,
      prenom: ligne.prenom,
      matricule: ligne.matricule,
      moyenne: ligne.matieres[0]?.moyenne ?? null,
      appreciation: ligne.matieres[0]?.appreciation ?? "Non noté",
    })),
    statistiques: {
      ...statistiques(moyennes.map((moyenne) => ({ moyenneGenerale: moyenne }))),
      notesPresentes: presentes,
      absences,
    },
  };
}

export async function analyseTemporelle(session: SessionUser, request: Request) {
  const params = searchParams(request);
  const eleveId = optionalUuid(params, "eleveId");
  const classeId = optionalUuid(params, "classeId");
  if (!eleveId && !classeId) {
    throw notFound("Élève ou classe requis.");
  }
  const db = getDb();
  let targetClass = classeId;
  if (eleveId) {
    const [link] = await db
      .select({ classeId: inscription.classeId })
      .from(inscription)
      .where(and(eq(inscription.eleveId, eleveId), eq(inscription.statut, "INSCRIT")))
      .limit(1);
    if (!link) throw notFound("Élève introuvable.");
    targetClass = link.classeId;
  }
  if (!targetClass) throw notFound("Classe introuvable.");
  const { classe: classeRow } = await assertClasseLisible(session, targetClass);
  const periodes = await db
    .select()
    .from(periode)
    .where(eq(periode.anneeScolaireId, classeRow.anneeScolaireId))
    .orderBy(asc(periode.ordre));
  const points = [];
  for (const item of periodes) {
    const url = new URL(request.url);
    url.searchParams.set("classeId", targetClass);
    url.searchParams.set("periodeId", item.id);
    if (eleveId) url.searchParams.set("eleveId", eleveId);
    const fake = new Request(url);
    if (eleveId) {
      const detail = await bulletin(session, fake);
      points.push({
        periodeId: item.id,
        libelle: item.libelle,
        ordre: item.ordre,
        moyenneGenerale: detail.moyenneGenerale,
        appreciation: detail.appreciation,
        lignes: detail.lignes,
      });
    } else {
      const detail = await analyseClasse(session, fake);
      points.push({
        periodeId: item.id,
        libelle: item.libelle,
        ordre: item.ordre,
        statistiques: detail.statistiques,
      });
    }
  }
  return { classeId: targetClass, eleveId: eleveId ?? null, periodes: points };
}

export async function analyseEtablissement(session: SessionUser, request: Request) {
  if (!canReadEstablishmentDashboard(session.role)) {
    throw forbidden("Le tableau de bord d'établissement est réservé à la direction, à la consultation et à l'administration.");
  }
  const params = searchParams(request);
  const periodeId = optionalUuid(params, "periodeId");
  let anneeId = optionalUuid(params, "anneeScolaireId");
  const db = getDb();
  if (!anneeId) {
    const [courante] = await db.select().from(anneeScolaire).where(eq(anneeScolaire.statut, "EN_COURS")).limit(1);
    if (!courante) throw notFound("Aucune année en cours.");
    anneeId = courante.id;
  }
  const classes = await db.select().from(classe).where(eq(classe.anneeScolaireId, anneeId)).orderBy(asc(classe.nom));
  const parClasse = [];
  const tous: Array<{ moyenneGenerale: number | null }> = [];
  for (const item of classes) {
    const subjects = await matieresDeClasse(item.id);
    const students = await inscritsDeClasse(item.id);
    const rows = await notesDeClasse(item.id, { periodeId });
    const lignes = syntheseClasse(students, subjects, rows);
    const stats = statistiques(lignes);
    parClasse.push({ classeId: item.id, nom: item.nom, statistiques: stats });
    tous.push(...lignes);
  }
  return {
    anneeScolaireId: anneeId,
    periodeId: periodeId ?? null,
    classes: parClasse,
    etablissement: statistiques(tous),
  };
}

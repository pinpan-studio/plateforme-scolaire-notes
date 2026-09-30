import { and, asc, eq, inArray } from "drizzle-orm";
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
  appreciate,
  compareTerms,
  computePeriodReport,
  computeStatistics,
  GradingError,
  rankCompetition,
  type GradeInput,
  type PeriodReport,
  type SubjectInput,
  type TermSnapshot,
} from "@/lib/grading";
import { canReadEstablishmentDashboard, type SessionUser } from "@/lib/auth/permissions";
import { getDb } from "./db";
import { ApiError, forbidden, notFound } from "./errors";
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

type SubjectRef = { matiereId: string; nom: string; code: string; coefficient: number };

function rethrowGrading(error: unknown): never {
  if (error instanceof GradingError) {
    throw new ApiError(422, "VALIDATION", error.message);
  }
  throw error;
}

function toGrades(rows: GradeRow[]): GradeInput[] {
  return rows.map((row) => ({
    score: row.estAbsent ? 0 : Number(row.valeur),
    maxScore: row.noteMax,
    coefficient: row.coefficientEvaluation,
    absent: row.estAbsent,
  }));
}

function noteKey(eleveId: string, matiereId: string) {
  return `${eleveId}\0${matiereId}`;
}

function indexerNotes(rows: GradeRow[]) {
  const index = new Map<string, GradeRow[]>();
  for (const row of rows) {
    const key = noteKey(row.eleveId, row.matiereId);
    const bucket = index.get(key);
    if (bucket) bucket.push(row);
    else index.set(key, [row]);
  }
  return index;
}

function periodReport(subjects: SubjectRef[], notes: Map<string, GradeRow[]>, eleveId: string): PeriodReport {
  const input: SubjectInput[] = subjects.map((subject) => ({
    id: subject.matiereId,
    coefficient: subject.coefficient,
    grades: toGrades(notes.get(noteKey(eleveId, subject.matiereId)) ?? []),
  }));
  try {
    return computePeriodReport(input);
  } catch (error) {
    rethrowGrading(error);
  }
}

type Classement = { rang: number | null; effectifClasse: number };

function classer<T>(items: readonly T[], score: (item: T) => number | null): Map<T, Classement> {
  let ranked: ReturnType<typeof rankCompetition<T>>;
  try {
    ranked = rankCompetition(items, score);
  } catch (error) {
    rethrowGrading(error);
  }
  const effectifClasse = ranked.filter((entry) => entry.rank !== null).length;
  return new Map(ranked.map((entry) => [entry.item, { rang: entry.rank, effectifClasse }]));
}

function mention(value: number | null): string {
  if (value === null) return "Non noté";
  try {
    return appreciate(value).label;
  } catch (error) {
    rethrowGrading(error);
  }
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

async function notesDeClasse(
  classeId: string,
  filtre: { periodeId?: string; matiereId?: string; matiereIds?: string[] },
) {
  const filters = [eq(evaluation.classeId, classeId)];
  if (filtre.periodeId) filters.push(eq(evaluation.periodeId, filtre.periodeId));
  if (filtre.matiereId) filters.push(eq(evaluation.matiereId, filtre.matiereId));
  if (filtre.matiereIds) {
    if (filtre.matiereIds.length === 0) return [];
    filters.push(inArray(evaluation.matiereId, filtre.matiereIds));
  }
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

function syntheseClasse(students: Inscrit[], subjects: SubjectRef[], rows: GradeRow[]) {
  const notes = indexerNotes(rows);
  const lignes = students.map((student) => {
    const report = periodReport(subjects, notes, student.eleveId);
    const moyennes = new Map(report.subjects.map((item) => [item.id, item.average.value]));
    const matieres = subjects.map((subject) => {
      const moyenne = moyennes.get(subject.matiereId) ?? null;
      return {
        matiereId: subject.matiereId,
        code: subject.code,
        nom: subject.nom,
        coefficient: subject.coefficient,
        moyenne,
        appreciation: mention(moyenne),
      };
    });
    return {
      ...student,
      matieres,
      moyenneGenerale: report.overall.value,
      appreciation: mention(report.overall.value),
    };
  });
  const rangGeneral = classer(lignes, (ligne) => ligne.moyenneGenerale);
  const rangParMatiere = subjects.map((_, index) =>
    classer(lignes, (ligne) => ligne.matieres[index]?.moyenne ?? null),
  );
  return lignes
    .map((ligne) => {
      const general = rangGeneral.get(ligne) ?? { rang: null, effectifClasse: 0 };
      return {
        ...ligne,
        rang: general.rang,
        effectifClasse: general.effectifClasse,
        matieres: ligne.matieres.map((matiere, index) => {
          const sujet = rangParMatiere[index]?.get(ligne) ?? { rang: null, effectifClasse: 0 };
          return { ...matiere, rang: sujet.rang, effectifClasse: sujet.effectifClasse };
        }),
      };
    })
    .sort((a, b) => {
      if (a.rang === null && b.rang === null) return a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr");
      if (a.rang === null) return 1;
      if (b.rang === null) return -1;
      return a.rang - b.rang || a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr");
    });
}

function statistiques(lignes: Array<{ moyenneGenerale: number | null }>) {
  const valeurs = lignes.map((ligne) => ligne.moyenneGenerale).filter((valeur): valeur is number => valeur !== null);
  let stats: ReturnType<typeof computeStatistics> = null;
  try {
    stats = computeStatistics(valeurs);
  } catch (error) {
    rethrowGrading(error);
  }
  return {
    effectif: lignes.length,
    calculables: stats?.count ?? 0,
    moyenneClasse: stats?.average ?? null,
    minimum: stats?.min ?? null,
    maximum: stats?.max ?? null,
    mediane: stats?.median ?? null,
    tauxReussite: stats?.passRatePercent ?? null,
    distribution: (stats?.distribution ?? []).map((band) => ({
      code: band.code,
      libelle: band.label,
      min: band.min,
      max: band.max,
      effectif: band.count,
    })),
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
  const [{ scope }, subjectsAll, periodeInfo] = await Promise.all([
    assertClasseLisible(session, student.classeId),
    matieresDeClasse(student.classeId),
    periodeDuBulletin(periodeId),
  ]);
  const allowed = subjectIdsForClass(scope, student.classeId);
  const subjects = allowed ? subjectsAll.filter((subject) => allowed.includes(subject.matiereId)) : subjectsAll;
  if (subjects.length === 0) {
    return refuse(session, "GET", "bulletin", eleveId, "Ce bulletin est hors de votre périmètre.");
  }
  const complet = allowed === null;
  const sujetsDuCalcul = complet ? subjectsAll : subjects;
  const [inscrits, rows] = await Promise.all([
    inscritsDeClasse(student.classeId),
    notesDeClasse(student.classeId, {
      periodeId,
      matiereIds: complet ? undefined : sujetsDuCalcul.map((subject) => subject.matiereId),
    }),
  ]);
  const lignes = syntheseClasse(inscrits, sujetsDuCalcul, rows);
  const ligne = lignes.find((item) => item.eleveId === student.eleveId);
  if (!ligne) throw notFound("Élève introuvable.");
  return {
    eleve: { id: student.eleveId, matricule: student.matricule, nom: student.nom, prenom: student.prenom },
    classe: { id: student.classeId, nom: student.classeNom },
    periode: periodeInfo,
    lignes: ligne.matieres.filter((item) => !allowed || allowed.includes(item.matiereId)),
    moyenneGenerale: complet ? ligne.moyenneGenerale : null,
    appreciation: complet ? ligne.appreciation : null,
    rang: complet ? ligne.rang : null,
    effectif: complet ? inscrits.length : null,
    effectifClasse: complet ? ligne.effectifClasse : null,
  };
}

async function periodeDuBulletin(periodeId: string | undefined) {
  if (!periodeId) return { id: null, libelle: "Année" };
  const [periodeRow] = await getDb()
    .select({ id: periode.id, libelle: periode.libelle })
    .from(periode)
    .where(eq(periode.id, periodeId))
    .limit(1);
  if (!periodeRow) throw notFound("Période introuvable.");
  return { id: periodeRow.id, libelle: periodeRow.libelle };
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
  const rows = await notesDeClasse(classeId, {
    periodeId,
    matiereId,
    matiereIds: allowed && !matiereId ? allowed : undefined,
  });
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
      effectifClasse: complet ? ligne.effectifClasse : null,
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
      rang: ligne.rang,
      effectifClasse: ligne.effectifClasse,
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
  const snapshots: TermSnapshot[] = [];
  for (const item of periodes) {
    const url = new URL(request.url);
    url.searchParams.set("classeId", targetClass);
    url.searchParams.set("periodeId", item.id);
    if (eleveId) url.searchParams.set("eleveId", eleveId);
    const fake = new Request(url);
    if (eleveId) {
      const detail = await bulletin(session, fake);
      snapshots.push({ id: item.id, label: item.libelle, average: detail.moyenneGenerale });
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
      snapshots.push({ id: item.id, label: item.libelle, average: detail.statistiques.moyenneClasse });
      points.push({
        periodeId: item.id,
        libelle: item.libelle,
        ordre: item.ordre,
        statistiques: detail.statistiques,
      });
    }
  }
  let comparaison: ReturnType<typeof compareTerms>;
  try {
    comparaison = compareTerms(snapshots);
  } catch (error) {
    rethrowGrading(error);
  }
  return { classeId: targetClass, eleveId: eleveId ?? null, periodes: points, comparaison };
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

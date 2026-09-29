import { apiFetch, listeQuery } from "@/lib/api-client/http";
import type {
  Affectation,
  AffectationEnvoi,
  Annee,
  AnneeEnvoi,
  AppreciationGeneraleEnvoi,
  Bulletin,
  ClasseDetail,
  ClasseEnvoi,
  ClasseResume,
  Distribution,
  EleveEnvoi,
  EleveFiche,
  EleveResume,
  EnregistrementNotes,
  Enseignant,
  EnseignantEnvoi,
  Etablissement,
  EtablissementPublic,
  EvaluationDetail,
  EvaluationEnvoi,
  EvaluationResume,
  EvolutionAnalyses,
  GrilleNotes,
  LigneNoteEnvoi,
  ListeParams,
  Matiere,
  MatiereEnvoi,
  MotDePasseTemporaire,
  MoyennesMatieres,
  Niveau,
  PageResult,
  Periode,
  PeriodeEnvoi,
  ResultatsClasse,
  Session,
  SousSeuil,
  SyntheseClasse,
  TableauDeBord,
  Utilisateur,
  UtilisateurCree,
  UtilisateurEnvoi,
} from "@/lib/api-client/types";

export { ApiError } from "@/lib/api-client/http";
export { indexErreurs, messageUtilisateur, raisonInterdit } from "@/lib/api-client/http";
export type * from "@/lib/api-client/types";

function paramsAnnee(anneeId: string | null | undefined, extra: ListeParams = {}): ListeParams {
  return { ...extra, anneeId: anneeId ?? undefined };
}

export const api = {
  session: () => apiFetch<Session>("/api/session"),

  etablissementPublic: () => apiFetch<EtablissementPublic>("/api/public/etablissement"),

  connexion: (email: string, motDePasse: string) =>
    apiFetch<Session>("/api/auth/connexion", {
      method: "POST",
      body: JSON.stringify({ email, motDePasse }),
    }),

  deconnexion: () => apiFetch<void>("/api/auth/deconnexion", { method: "POST" }),

  etablissement: () => apiFetch<Etablissement>("/api/etablissement"),

  enregistrerEtablissement: (corps: Omit<Etablissement, "id">) =>
    apiFetch<Etablissement>("/api/etablissement", {
      method: "PATCH",
      body: JSON.stringify(corps),
    }),

  annees: () => apiFetch<Annee[]>("/api/annees"),

  creerAnnee: (corps: AnneeEnvoi) =>
    apiFetch<Annee>("/api/annees", { method: "POST", body: JSON.stringify(corps) }),

  activerAnnee: (id: string) => apiFetch<Annee>(`/api/annees/${id}/activer`, { method: "POST" }),

  cloturerAnnee: (id: string) => apiFetch<Annee>(`/api/annees/${id}/cloturer`, { method: "POST" }),

  niveaux: () => apiFetch<Niveau[]>("/api/niveaux"),

  periodes: (anneeId: string | null) => apiFetch<Periode[]>(listeQuery("/api/periodes", { anneeId })),

  creerPeriode: (corps: PeriodeEnvoi) =>
    apiFetch<Periode>("/api/periodes", { method: "POST", body: JSON.stringify(corps) }),

  classes: (params: ListeParams) => apiFetch<PageResult<ClasseResume>>(listeQuery("/api/classes", params)),

  classe: (id: string) => apiFetch<ClasseDetail>(`/api/classes/${id}`),

  creerClasse: (corps: ClasseEnvoi) =>
    apiFetch<ClasseDetail>("/api/classes", { method: "POST", body: JSON.stringify(corps) }),

  modifierClasse: (id: string, corps: ClasseEnvoi) =>
    apiFetch<ClasseDetail>(`/api/classes/${id}`, { method: "PATCH", body: JSON.stringify(corps) }),

  synthese: (id: string, anneeId: string | null, periodeId?: string) =>
    apiFetch<SyntheseClasse>(listeQuery(`/api/classes/${id}/synthese`, paramsAnnee(anneeId, { periodeId }))),

  eleves: (params: ListeParams) => apiFetch<PageResult<EleveResume>>(listeQuery("/api/eleves", params)),

  eleve: (id: string, anneeId: string | null) =>
    apiFetch<EleveFiche>(listeQuery(`/api/eleves/${id}`, { anneeId })),

  creerEleve: (corps: EleveEnvoi) =>
    apiFetch<EleveFiche>("/api/eleves", { method: "POST", body: JSON.stringify(corps) }),

  modifierEleve: (id: string, corps: EleveEnvoi) =>
    apiFetch<EleveFiche>(`/api/eleves/${id}`, { method: "PATCH", body: JSON.stringify(corps) }),

  enseignants: (params: ListeParams = {}) =>
    apiFetch<PageResult<Enseignant>>(listeQuery("/api/enseignants", params)),

  creerEnseignant: (corps: EnseignantEnvoi) =>
    apiFetch<Enseignant>("/api/enseignants", { method: "POST", body: JSON.stringify(corps) }),

  modifierEnseignant: (id: string, corps: EnseignantEnvoi) =>
    apiFetch<Enseignant>(`/api/enseignants/${id}`, { method: "PATCH", body: JSON.stringify(corps) }),

  matieres: (params: ListeParams = {}) => apiFetch<PageResult<Matiere>>(listeQuery("/api/matieres", params)),

  creerMatiere: (corps: MatiereEnvoi) =>
    apiFetch<Matiere>("/api/matieres", { method: "POST", body: JSON.stringify(corps) }),

  modifierMatiere: (id: string, corps: MatiereEnvoi) =>
    apiFetch<Matiere>(`/api/matieres/${id}`, { method: "PATCH", body: JSON.stringify(corps) }),

  affectations: (params: ListeParams) =>
    apiFetch<PageResult<Affectation>>(listeQuery("/api/affectations", params)),

  creerAffectation: (corps: AffectationEnvoi) =>
    apiFetch<Affectation>("/api/affectations", { method: "POST", body: JSON.stringify(corps) }),

  supprimerAffectation: (id: string) => apiFetch<void>(`/api/affectations/${id}`, { method: "DELETE" }),

  evaluations: (params: ListeParams) =>
    apiFetch<PageResult<EvaluationResume>>(listeQuery("/api/evaluations", params)),

  evaluation: (id: string) => apiFetch<EvaluationDetail>(`/api/evaluations/${id}`),

  creerEvaluation: (corps: EvaluationEnvoi) =>
    apiFetch<EvaluationDetail>("/api/evaluations", { method: "POST", body: JSON.stringify(corps) }),

  modifierEvaluation: (id: string, corps: EvaluationEnvoi) =>
    apiFetch<EvaluationDetail>(`/api/evaluations/${id}`, { method: "PATCH", body: JSON.stringify(corps) }),

  supprimerEvaluation: (id: string) => apiFetch<void>(`/api/evaluations/${id}`, { method: "DELETE" }),

  grille: (evaluationId: string) => apiFetch<GrilleNotes>(`/api/evaluations/${evaluationId}/notes`),

  enregistrerNotes: (evaluationId: string, lignes: LigneNoteEnvoi[]) =>
    apiFetch<EnregistrementNotes>(`/api/evaluations/${evaluationId}/notes`, {
      method: "PUT",
      body: JSON.stringify({ lignes }),
    }),

  resultats: (params: ListeParams) => apiFetch<ResultatsClasse>(listeQuery("/api/resultats", params)),

  bulletin: (eleveId: string, params: ListeParams) =>
    apiFetch<Bulletin>(listeQuery(`/api/bulletins/${eleveId}`, params)),

  enregistrerAppreciation: (corps: AppreciationGeneraleEnvoi) =>
    apiFetch<{ texte: string }>("/api/appreciations-generales", {
      method: "PUT",
      body: JSON.stringify(corps),
    }),

  tableauDeBord: (anneeId: string | null) =>
    apiFetch<TableauDeBord>(listeQuery("/api/tableau-de-bord", { anneeId })),

  distribution: (params: ListeParams) =>
    apiFetch<Distribution>(listeQuery("/api/analyses/distribution", params)),

  moyennesMatieres: (params: ListeParams) =>
    apiFetch<MoyennesMatieres>(listeQuery("/api/analyses/matieres", params)),

  evolution: (params: ListeParams) =>
    apiFetch<EvolutionAnalyses>(listeQuery("/api/analyses/evolution", params)),

  sousSeuil: (params: ListeParams & { seuil?: number }) =>
    apiFetch<SousSeuil>(listeQuery("/api/analyses/sous-seuil", params)),

  utilisateurs: () => apiFetch<Utilisateur[]>("/api/utilisateurs"),

  creerUtilisateur: (corps: UtilisateurEnvoi) =>
    apiFetch<UtilisateurCree>("/api/utilisateurs", { method: "POST", body: JSON.stringify(corps) }),

  modifierUtilisateur: (id: string, corps: { actif: boolean; role: Utilisateur["role"]; enseignantId: string | null }) =>
    apiFetch<Utilisateur>(`/api/utilisateurs/${id}`, { method: "PATCH", body: JSON.stringify(corps) }),

  motDePasseTemporaire: (id: string) =>
    apiFetch<MotDePasseTemporaire>(`/api/utilisateurs/${id}/mot-de-passe-temporaire`, { method: "POST" }),

  changerMotDePasse: (corps: { motDePasseActuel: string; nouveauMotDePasse: string }) =>
    apiFetch<void>("/api/profil/mot-de-passe", { method: "PATCH", body: JSON.stringify(corps) }),
};

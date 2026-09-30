/**
 * Contrat d'API consommé par l'interface.
 * Les décisions qui complètent docs/01 et docs/02 sont dans docs/04-frontend.md.
 * Le frontend n'implémente pas ces routes : il les appelle.
 */

export type Role = "ADMIN" | "DIRECTION" | "ENSEIGNANT" | "PROFESSEUR_PRINCIPAL" | "CONSULTATION";

export type StatutAnnee = "PREPARATION" | "EN_COURS" | "CLOTUREE";

export type StatutEleve = "ACTIF" | "SORTI" | "TRANSFERE";

export type StatutInscription = "INSCRIT" | "SORTI" | "TRANSFERE";

export type Sexe = "F" | "M";

export type TypeEvaluation = "DEVOIR" | "INTERROGATION" | "COMPOSITION";

export type Annee = {
  id: string;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  statut: StatutAnnee;
};

export type Session = {
  utilisateur: {
    id: string;
    email: string;
    prenom: string;
    nom: string;
    role: Role;
    enseignantId: string | null;
    telephone: string | null;
  };
  etablissement: {
    id: string;
    nom: string;
  };
  anneeActive: Annee | null;
  annees: Annee[];
};

export type Etablissement = {
  id: string;
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
};

export type EtablissementPublic = {
  nom: string;
};

export type Niveau = {
  id: string;
  code: string;
  nom: string;
  ordre: number;
};

export type Periode = {
  id: string;
  anneeScolaireId: string;
  libelle: string;
  ordre: number;
  dateDebut: string;
  dateFin: string;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ListeParams = {
  anneeId?: string | null;
  q?: string;
  page?: number;
  pageSize?: number;
  tri?: string;
  ordre?: "asc" | "desc";
  classeId?: string;
  niveauId?: string;
  periodeId?: string;
  matiereId?: string;
  statut?: string;
  enseignantId?: string;
  eleveId?: string;
  evaluationId?: string;
};

export type ChampErreur = {
  champ: string;
  message: string;
};

export type ApiErrorBody = {
  code: string;
  message: string;
  champs?: ChampErreur[];
};

export type ClasseResume = {
  id: string;
  nom: string;
  niveau: string;
  niveauId: string;
  effectif: number;
  professeurPrincipal: string | null;
  professeurPrincipalId: string | null;
  annee: string;
  anneeScolaireId: string;
};

export type ClasseEnvoi = {
  nom: string;
  niveauId: string;
  anneeScolaireId: string;
  professeurPrincipalId: string | null;
};

export type EleveResume = {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  classe: string | null;
  classeId: string | null;
  statut: StatutInscription;
};

export type EleveEnvoi = {
  matricule: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  sexe: Sexe;
  classeId: string;
  statut: StatutInscription;
};

export type NoteHistorique = {
  evaluationId: string;
  date: string;
  type: TypeEvaluation;
  libelle: string;
  matiere: string;
  periode: string;
  valeur: number | null;
  absent: boolean;
  noteMax: number;
  coefficient: number;
  commentaire: string | null;
};

export type LigneMatiereResultat = {
  matiereId: string;
  nom: string;
  coefficient: number;
  moyenne: number | null;
  appreciation: string;
  rang: number | null;
  /** Élèves classés dans la matière. `0` si aucune moyenne n'est publiée. */
  effectifClasse: number;
};

export type EleveFiche = {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  dateNaissance: string | null;
  sexe: Sexe | null;
  statut: StatutEleve;
  inscription: {
    id: string;
    classeId: string;
    classeNom: string;
    statut: StatutInscription;
  } | null;
  resultats: {
    moyenneGenerale: number | null;
    rang: number | null;
    effectif: number;
    /** Élèves classés sur la moyenne générale. `null` si le bulletin est réduit. */
    effectifClasse: number | null;
    appreciation: string;
    matieresSansNote: number;
    matieres: LigneMatiereResultat[];
  } | null;
  historique: NoteHistorique[];
};

export type Enseignant = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  statut: "ACTIF" | "INACTIF";
};

export type EnseignantEnvoi = {
  nom: string;
  prenom: string;
  email: string;
  telephone: string | null;
  statut: "ACTIF" | "INACTIF";
};

export type Matiere = {
  id: string;
  code: string;
  nom: string;
  coefficient: number;
  niveauId: string | null;
  niveau: string | null;
};

export type MatiereEnvoi = {
  code: string;
  nom: string;
  coefficient: number;
  niveauId: string | null;
};

export type Affectation = {
  id: string;
  enseignantId: string;
  enseignant: string;
  classeId: string;
  classe: string;
  matiereId: string;
  matiere: string;
  anneeScolaireId: string;
  annee: string;
};

export type AffectationEnvoi = {
  enseignantId: string;
  classeId: string;
  matiereId: string;
  anneeScolaireId: string;
};

export type EvaluationResume = {
  id: string;
  date: string;
  type: TypeEvaluation;
  libelle: string;
  matiere: string;
  matiereId: string;
  classe: string;
  classeId: string;
  periode: string;
  periodeId: string;
  noteMax: number;
  coefficient: number;
  saisies: number;
  effectif: number;
};

export type EvaluationDetail = EvaluationResume & {
  enseignantId: string;
  enseignant: string;
  anneeScolaireId: string;
  supprimable: boolean;
  motifSuppression: string | null;
};

export type EvaluationEnvoi = {
  matiereId: string;
  classeId: string;
  enseignantId: string;
  periodeId: string;
  type: TypeEvaluation;
  libelle: string;
  date: string;
  noteMax: number;
  coefficient: number;
};

export type LigneGrille = {
  eleveId: string;
  matricule: string;
  nom: string;
  prenom: string;
  valeur: number | null;
  absent: boolean;
  commentaire: string | null;
  noteId?: string | null;
};

export type GrilleNotes = {
  evaluation: EvaluationDetail;
  peutModifier: boolean;
  motifLectureSeule: string | null;
  lignes: LigneGrille[];
};

export type LigneNoteEnvoi = {
  eleveId: string;
  valeur: number | null;
  absent: boolean;
  commentaire: string | null;
  /** Demande la suppression de la note enregistrée. Le schéma n'accepte pas une ligne ni absente ni chiffrée. */
  supprimer: boolean;
};

export type EnregistrementNotes = {
  message: string;
  grille: GrilleNotes;
};

export type LigneResultat = {
  eleveId: string;
  matricule: string;
  nom: string;
  prenom: string;
  moyenneGenerale: number | null;
  rang: number | null;
  effectif: number;
  effectifClasse: number | null;
  appreciation: string;
  appreciationGenerale: string | null;
  matieresSansNote: number;
  matieres: LigneMatiereResultat[];
  evolution: { periodeId: string; libelle: string; moyenne: number | null }[];
};

export type ResultatsClasse = {
  classe: { id: string; nom: string; effectif: number };
  periode: { id: string; libelle: string } | null;
  peutRedigerAppreciation: boolean;
  lignes: LigneResultat[];
  evolutionClasse: { periodeId: string; libelle: string; moyenne: number | null; effectif: number }[];
};

export type Bulletin = {
  etablissement: { nom: string; adresse: string };
  eleve: { id: string; matricule: string; nom: string; prenom: string };
  classe: { id: string; nom: string; effectif: number };
  periode: { id: string; libelle: string } | null;
  matieres: LigneMatiereResultat[];
  moyenneGenerale: number | null;
  rang: number | null;
  /** Élèves classés sur la moyenne générale. `null` si le bulletin est réduit. */
  effectifClasse: number | null;
  appreciation: string;
  appreciationGenerale: string | null;
  peutRedigerAppreciation: boolean;
  matieresSansNote: number;
  reduitAuxMatieres: boolean;
};

export type AppreciationGeneraleEnvoi = {
  eleveId: string;
  periodeId: string;
  texte: string;
};

export type TrancheDistribution = {
  libelle: string;
  min: number;
  max: number | null;
  effectif: number;
};

export type Distribution = {
  tranches: TrancheDistribution[];
};

export type MoyennesMatieres = {
  matieres: { matiereId: string; nom: string; moyenne: number | null; effectif: number }[];
};

export type EvolutionAnalyses = {
  points: { periodeId: string; libelle: string; moyenne: number | null; effectif: number }[];
};

export type SousSeuil = {
  seuil: number;
  effectif: number;
  eleves: { eleveId: string; nom: string; prenom: string; classe: string; moyenne: number }[];
};

export type Indicateur = {
  id: string;
  libelle: string;
  valeur: string;
  href: string;
};

export type TableauDeBord = {
  indicateurs: Indicateur[];
  evaluationsASaisir: {
    id: string;
    libelle: string;
    classe: string;
    matiere: string;
    date: string;
    saisies: number;
    effectif: number;
  }[];
  affectations: { id: string; classe: string; matiere: string }[];
  dernierEnregistrement: { libelle: string; horodatage: string } | null;
  appreciationsManquantes: number | null;
  classesEnDifficulte: { classeId: string; nom: string; moyenne: number | null }[];
  alerteSansDirection: boolean;
};

export type SyntheseClasse = {
  classe: { id: string; nom: string; effectif: number };
  periode: { id: string; libelle: string } | null;
  peutRedigerAppreciation: boolean;
  moyennesMatieres: { matiereId: string; nom: string; coefficient: number; moyenne: number | null }[];
  eleves: {
    eleveId: string;
    nom: string;
    prenom: string;
    moyenne: number | null;
    rang: number | null;
    effectif: number;
    effectifClasse: number | null;
    appreciation: string;
    appreciationGenerale: string | null;
    appreciationManquante: boolean;
  }[];
};

export type ClasseDetail = {
  id: string;
  nom: string;
  niveau: string;
  niveauId: string;
  annee: string;
  anneeScolaireId: string;
  professeurPrincipal: string | null;
  professeurPrincipalId: string | null;
  peutModifier: boolean;
  eleves: EleveResume[];
  enseignements: { enseignantId: string; enseignant: string; matiereId: string; matiere: string }[];
};

export type AnneeEnvoi = {
  libelle: string;
  dateDebut: string;
  dateFin: string;
};

export type PeriodeEnvoi = {
  anneeScolaireId: string;
  libelle: string;
  ordre: number;
  dateDebut: string;
  dateFin: string;
};

export type Utilisateur = {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: Role;
  enseignantId: string | null;
  enseignant: string | null;
  actif: boolean;
};

export type UtilisateurEnvoi = {
  email: string;
  prenom: string;
  nom: string;
  role: Role;
  enseignantId: string | null;
  motDePasse: string;
};

export type UtilisateurCree = Utilisateur & {
  motDePasseTemporaire: string;
};

export type MotDePasseTemporaire = {
  motDePasseTemporaire: string;
};

export type AnneeCreee = Annee;

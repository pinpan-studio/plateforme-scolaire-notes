import { ApiError, apiFetch, listeQuery } from "@/lib/api-client/http";
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
  LigneGrille,
  LigneNoteEnvoi,
  LigneResultat,
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
  Role,
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

type Brut = Record<string, unknown>;

function rec(value: unknown): Brut {
  return value && typeof value === "object" ? (value as Brut) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** L'API pagine `{ data }` et filtre `anneeScolaireId`, `sort`, `order`. */
function versApi(params: ListeParams = {}): Record<string, string | number | null | undefined> {
  const { anneeId, tri, ordre, ...reste } = params;
  return {
    ...reste,
    anneeScolaireId: anneeId ?? undefined,
    sort: tri,
    order: ordre,
  };
}

function pageDe<T>(payload: unknown, params: ListeParams, map: (row: unknown) => T): PageResult<T> {
  if (Array.isArray(payload)) {
    const tous = payload.map(map);
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 25;
    const debut = (page - 1) * pageSize;
    return { items: tous.slice(debut, debut + pageSize), total: tous.length, page, pageSize };
  }
  const body = rec(payload);
  const lignes = Array.isArray(body.data) ? body.data : [];
  return {
    items: lignes.map(map),
    total: typeof body.total === "number" ? body.total : lignes.length,
    page: typeof body.page === "number" ? body.page : 1,
    pageSize: typeof body.pageSize === "number" ? body.pageSize : params.pageSize ?? 25,
  };
}

function mapAnnee(row: unknown): Annee {
  const item = rec(row);
  return {
    id: str(item.id),
    libelle: str(item.libelle),
    dateDebut: str(item.dateDebut),
    dateFin: str(item.dateFin),
    statut: str(item.statut) as Annee["statut"],
  };
}

function mapEleve(row: unknown): EleveResume {
  const item = rec(row);
  const inscription = item.inscription ? rec(item.inscription) : null;
  const statut = str(inscription?.statut ?? item.statut, "INSCRIT");
  return {
    id: str(item.id),
    matricule: str(item.matricule),
    nom: str(item.nom),
    prenom: str(item.prenom),
    classe: strOrNull(inscription?.classeNom ?? item.classe),
    classeId: strOrNull(inscription?.classeId ?? item.classeId),
    statut: (statut === "ACTIF" ? "INSCRIT" : statut) as EleveResume["statut"],
  };
}

function mapClasse(row: unknown): ClasseResume {
  const item = rec(row);
  return {
    id: str(item.id),
    nom: str(item.nom),
    niveau: str(item.niveau ?? item.niveauCode),
    niveauId: str(item.niveauId),
    effectif: num(item.effectif),
    professeurPrincipal: strOrNull(item.professeurPrincipal),
    professeurPrincipalId: strOrNull(item.professeurPrincipalId),
    annee: str(item.annee ?? item.anneeLibelle),
    anneeScolaireId: str(item.anneeScolaireId),
  };
}

function mapEnseignant(row: unknown): Enseignant {
  const item = rec(row);
  return {
    id: str(item.id),
    nom: str(item.nom),
    prenom: str(item.prenom),
    email: str(item.email),
    telephone: strOrNull(item.telephone),
    statut: str(item.statut, "ACTIF") as Enseignant["statut"],
  };
}

function mapMatiere(row: unknown, niveaux: Map<string, string>): Matiere {
  const item = rec(row);
  const niveauId = strOrNull(item.niveauId);
  return {
    id: str(item.id),
    code: str(item.code),
    nom: str(item.nom),
    coefficient: num(item.coefficient),
    niveauId,
    niveau: niveauId ? (niveaux.get(niveauId) ?? null) : null,
  };
}

function mapAffectation(row: unknown): Affectation {
  const item = rec(row);
  return {
    id: str(item.id),
    enseignantId: str(item.enseignantId),
    enseignant: str(item.enseignant),
    classeId: str(item.classeId),
    classe: str(item.classe),
    matiereId: str(item.matiereId),
    matiere: str(item.matiere),
    anneeScolaireId: str(item.anneeScolaireId),
    annee: str(item.annee),
  };
}

function mapEvaluation(row: unknown): EvaluationDetail {
  const item = rec(row);
  const saisies = num(item.saisies);
  return {
    id: str(item.id),
    date: str(item.date),
    type: str(item.type, "DEVOIR") as EvaluationDetail["type"],
    libelle: str(item.libelle),
    matiere: str(item.matiere),
    matiereId: str(item.matiereId),
    classe: str(item.classe),
    classeId: str(item.classeId),
    periode: str(item.periode),
    periodeId: str(item.periodeId),
    noteMax: num(item.noteMax, 20),
    coefficient: num(item.coefficient, 1),
    saisies,
    effectif: num(item.effectif),
    enseignantId: str(item.enseignantId),
    enseignant: str(item.enseignant),
    anneeScolaireId: str(item.anneeScolaireId),
    supprimable: typeof item.supprimable === "boolean" ? item.supprimable : saisies === 0,
    motifSuppression: strOrNull(item.motifSuppression),
  };
}

function mapUtilisateur(row: unknown): Utilisateur {
  const item = rec(row);
  return {
    id: str(item.id),
    email: str(item.email),
    prenom: str(item.prenom),
    nom: str(item.nom),
    role: str(item.role ?? item.roleCode) as Role,
    enseignantId: strOrNull(item.enseignantId),
    enseignant: strOrNull(item.enseignant),
    actif: item.actif !== false,
  };
}

function corpsEleve(corps: EleveEnvoi) {
  return {
    matricule: corps.matricule,
    nom: corps.nom,
    prenom: corps.prenom,
    dateNaissance: corps.dateNaissance,
    sexe: corps.sexe,
    classeId: corps.classeId,
    statut: corps.statut === "INSCRIT" ? "ACTIF" : corps.statut,
  };
}

async function ignorerInterdit<T>(promesse: Promise<T>, repli: T): Promise<T> {
  try {
    return await promesse;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return repli;
    throw error;
  }
}

export const api = {
  session: async (): Promise<Session> => {
    const corps = rec(await apiFetch("/api/auth/session"));
    const utilisateur = rec(corps.utilisateur);
    const annees = (await apiFetch<unknown[]>("/api/annees")).map(mapAnnee);
    const publique = await ignorerInterdit(apiFetch<EtablissementPublic>("/api/public/etablissement"), {
      nom: "Cahier de notes",
    });
    return {
      utilisateur: {
        id: str(utilisateur.id),
        email: str(utilisateur.email),
        prenom: str(utilisateur.prenom),
        nom: str(utilisateur.nom),
        role: str(utilisateur.role) as Role,
        enseignantId: strOrNull(utilisateur.enseignantId),
        telephone: null,
      },
      etablissement: { id: "", nom: publique.nom },
      anneeActive: annees.find((annee) => annee.statut === "EN_COURS") ?? null,
      annees,
    };
  },

  etablissementPublic: () => apiFetch<EtablissementPublic>("/api/public/etablissement"),

  connexion: async (email: string, motDePasse: string) => {
    await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, motDePasse }),
    });
    return api.session();
  },

  deconnexion: () => apiFetch<void>("/api/auth/logout", { method: "POST" }),

  etablissement: async () => {
    const row = rec(await apiFetch("/api/etablissement"));
    const fiche: Etablissement = {
      id: str(row.id),
      nom: str(row.nom),
      adresse: str(row.adresse),
      telephone: str(row.telephone),
      email: str(row.email),
    };
    return fiche;
  },

  enregistrerEtablissement: (corps: Omit<Etablissement, "id">) =>
    apiFetch<Etablissement>("/api/etablissement", { method: "PATCH", body: JSON.stringify(corps) }),

  annees: async () => (await apiFetch<unknown[]>("/api/annees")).map(mapAnnee),

  creerAnnee: (corps: AnneeEnvoi) =>
    apiFetch<unknown>("/api/annees", { method: "POST", body: JSON.stringify(corps) }).then(mapAnnee),

  activerAnnee: (id: string) =>
    apiFetch<unknown>(`/api/annees/${id}`, { method: "PATCH", body: JSON.stringify({ statut: "EN_COURS" }) }).then(mapAnnee),

  cloturerAnnee: (id: string) =>
    apiFetch<unknown>(`/api/annees/${id}`, { method: "PATCH", body: JSON.stringify({ statut: "CLOTUREE" }) }).then(mapAnnee),

  niveaux: async () => {
    const rows = await apiFetch<unknown[]>("/api/niveaux");
    return rows.map((row) => {
      const item = rec(row);
      const niveau: Niveau = { id: str(item.id), code: str(item.code), nom: str(item.nom), ordre: num(item.ordre) };
      return niveau;
    });
  },

  periodes: async (anneeId: string | null) => {
    const rows = await apiFetch<unknown[]>(listeQuery("/api/periodes", versApi({ anneeId })));
    return rows.map((row) => {
      const item = rec(row);
      const periode: Periode = {
        id: str(item.id),
        anneeScolaireId: str(item.anneeScolaireId),
        libelle: str(item.libelle),
        ordre: num(item.ordre),
        dateDebut: str(item.dateDebut),
        dateFin: str(item.dateFin),
      };
      return periode;
    });
  },

  creerPeriode: (corps: PeriodeEnvoi) =>
    apiFetch<Periode>("/api/periodes", { method: "POST", body: JSON.stringify(corps) }),

  classes: (params: ListeParams) =>
    apiFetch<unknown>(listeQuery("/api/classes", versApi(params))).then((payload) => pageDe(payload, params, mapClasse)),

  classe: async (id: string): Promise<ClasseDetail> => {
    const detail = mapClasse(await apiFetch(`/api/classes/${id}`));
    const [eleves, affectations] = await Promise.all([
      api.eleves({ classeId: id, anneeId: detail.anneeScolaireId, page: 1, pageSize: 100 }),
      api.affectations({ classeId: id, anneeId: detail.anneeScolaireId, page: 1, pageSize: 100 }),
    ]);
    return {
      ...detail,
      peutModifier: false,
      eleves: eleves.items,
      enseignements: affectations.items.map((item) => ({
        enseignantId: item.enseignantId,
        enseignant: item.enseignant,
        matiereId: item.matiereId,
        matiere: item.matiere,
      })),
    };
  },

  creerClasse: (corps: ClasseEnvoi) =>
    apiFetch<unknown>("/api/classes", { method: "POST", body: JSON.stringify(corps) }).then((row) => ({
      ...mapClasse(row),
      peutModifier: true,
      eleves: [],
      enseignements: [],
    })),

  modifierClasse: (id: string, corps: ClasseEnvoi) =>
    apiFetch<unknown>(`/api/classes/${id}`, { method: "PATCH", body: JSON.stringify(corps) }).then((row) => ({
      ...mapClasse(row),
      peutModifier: true,
      eleves: [],
      enseignements: [],
    })),

  synthese: async (id: string, anneeId: string | null, periodeId?: string): Promise<SyntheseClasse> => {
    const [resultats, moyennes, catalogue] = await Promise.all([
      api.resultats({ anneeId, classeId: id, periodeId }),
      api.moyennesMatieres({ anneeId, classeId: id, periodeId }),
      api.matieres({ page: 1, pageSize: 100 }),
    ]);
    const coefficient = new Map(catalogue.items.map((matiere) => [matiere.id, matiere.coefficient]));
    return {
      classe: resultats.classe,
      periode: resultats.periode,
      peutRedigerAppreciation: resultats.peutRedigerAppreciation,
      moyennesMatieres: moyennes.matieres.map((matiere) => ({
        matiereId: matiere.matiereId,
        nom: matiere.nom,
        coefficient: coefficient.get(matiere.matiereId) ?? 0,
        moyenne: matiere.moyenne,
      })),
      eleves: resultats.lignes.map((ligne) => ({
        eleveId: ligne.eleveId,
        nom: ligne.nom,
        prenom: ligne.prenom,
        moyenne: ligne.moyenneGenerale,
        rang: ligne.rang,
        effectif: ligne.effectif,
        appreciation: ligne.appreciation,
        appreciationGenerale: ligne.appreciationGenerale,
        appreciationManquante: !ligne.appreciationGenerale,
      })),
    };
  },

  eleves: (params: ListeParams) =>
    apiFetch<unknown>(listeQuery("/api/eleves", versApi(params))).then((payload) => pageDe(payload, params, mapEleve)),

  eleve: async (id: string, anneeId: string | null): Promise<EleveFiche> => {
    const row = rec(await apiFetch(listeQuery(`/api/eleves/${id}`, versApi({ anneeId }))));
    const inscription = row.inscription ? rec(row.inscription) : null;
    const classeId = strOrNull(inscription?.classeId);
    const bulletin = await ignorerInterdit(
      apiFetch<unknown>(listeQuery("/api/bulletins", versApi({ anneeId, eleveId: id }))),
      null,
    );
    const notes = await ignorerInterdit(
      apiFetch<unknown>(listeQuery("/api/notes", versApi({ eleveId: id, page: 1, pageSize: 100 }))),
      { data: [] },
    );
    const evaluations = classeId
      ? await ignorerInterdit(
          api.evaluations({ anneeId, classeId, page: 1, pageSize: 100 }),
          { items: [], total: 0, page: 1, pageSize: 100 },
        )
      : { items: [] as EvaluationResume[], total: 0, page: 1, pageSize: 100 };
    const parEvaluation = new Map(evaluations.items.map((item) => [item.id, item]));
    const document = bulletin ? rec(bulletin) : null;
    const lignes = Array.isArray(document?.lignes) ? document.lignes.map((ligne) => mapMatiereResultat(ligne)) : [];
    const noteRows = Array.isArray(rec(notes).data) ? (rec(notes).data as unknown[]) : [];
    return {
      id: str(row.id),
      matricule: str(row.matricule),
      nom: str(row.nom),
      prenom: str(row.prenom),
      dateNaissance: strOrNull(row.dateNaissance),
      sexe: (strOrNull(row.sexe) as EleveFiche["sexe"]) ?? null,
      statut: (str(row.statut, "ACTIF") === "ACTIF" ? "ACTIF" : str(row.statut)) as EleveFiche["statut"],
      inscription: inscription
        ? {
            id: str(inscription.id),
            classeId: str(inscription.classeId),
            classeNom: str(inscription.classeNom),
            statut: (str(inscription.statut, "INSCRIT") === "ACTIF" ? "INSCRIT" : str(inscription.statut, "INSCRIT")) as
              | "INSCRIT"
              | "SORTI"
              | "TRANSFERE",
          }
        : null,
      resultats: document
        ? {
            moyenneGenerale: numOrNull(document.moyenneGenerale),
            rang: numOrNull(document.rang),
            effectif: num(document.effectif),
            appreciation: str(document.appreciation),
            matieresSansNote: lignes.filter((ligne) => ligne.moyenne === null).length,
            matieres: lignes,
          }
        : null,
      historique: noteRows.map((note) => {
        const item = rec(note);
        const evaluation = parEvaluation.get(str(item.evaluationId));
        return {
          evaluationId: str(item.evaluationId),
          date: evaluation?.date ?? "",
          type: evaluation?.type ?? "DEVOIR",
          libelle: evaluation?.libelle ?? "Note",
          matiere: evaluation?.matiere ?? "",
          periode: evaluation?.periode ?? "",
          valeur: numOrNull(item.valeur),
          absent: bool(item.estAbsent),
          noteMax: num(item.noteMax ?? evaluation?.noteMax, 20),
          coefficient: evaluation?.coefficient ?? 1,
          commentaire: strOrNull(item.commentaire),
        };
      }),
    };
  },

  creerEleve: (corps: EleveEnvoi) =>
    apiFetch<unknown>("/api/eleves", { method: "POST", body: JSON.stringify(corpsEleve(corps)) }).then(ficheMinimale),

  modifierEleve: (id: string, corps: EleveEnvoi) =>
    apiFetch<unknown>(`/api/eleves/${id}`, {
      method: "PATCH",
      body: JSON.stringify(corpsEleve(corps)),
    }).then(ficheMinimale),

  enseignants: (params: ListeParams = {}) =>
    apiFetch<unknown>(listeQuery("/api/enseignants", versApi(params))).then((payload) =>
      pageDe(payload, params, (row) => mapEnseignant(row)),
    ),

  creerEnseignant: (corps: EnseignantEnvoi) =>
    apiFetch<unknown>("/api/enseignants", { method: "POST", body: JSON.stringify(corps) }).then(mapEnseignant),

  modifierEnseignant: (id: string, corps: EnseignantEnvoi) =>
    apiFetch<unknown>(`/api/enseignants/${id}`, { method: "PATCH", body: JSON.stringify(corps) }).then(mapEnseignant),

  matieres: async (params: ListeParams = {}) => {
    const niveaux = new Map((await api.niveaux()).map((niveau) => [niveau.id, niveau.nom]));
    const payload = await apiFetch<unknown>(listeQuery("/api/matieres", versApi(params)));
    return pageDe(payload, params, (row) => mapMatiere(row, niveaux));
  },

  creerMatiere: (corps: MatiereEnvoi) =>
    apiFetch<unknown>("/api/matieres", { method: "POST", body: JSON.stringify(corps) }).then((row) =>
      mapMatiere(row, new Map()),
    ),

  modifierMatiere: (id: string, corps: MatiereEnvoi) =>
    apiFetch<unknown>(`/api/matieres/${id}`, { method: "PATCH", body: JSON.stringify(corps) }).then((row) =>
      mapMatiere(row, new Map()),
    ),

  affectations: (params: ListeParams) =>
    apiFetch<unknown>(listeQuery("/api/affectations", versApi(params))).then((payload) =>
      pageDe(payload, params, (row) => mapAffectation(row)),
    ),

  creerAffectation: (corps: AffectationEnvoi) =>
    apiFetch<unknown>("/api/affectations", {
      method: "POST",
      body: JSON.stringify({
        enseignantId: corps.enseignantId,
        classeId: corps.classeId,
        matiereId: corps.matiereId,
      }),
    }).then((row) => mapAffectation(row)),

  supprimerAffectation: (id: string) => apiFetch<void>(`/api/affectations/${id}`, { method: "DELETE" }),

  evaluations: (params: ListeParams) =>
    apiFetch<unknown>(listeQuery("/api/evaluations", versApi(params))).then((payload) =>
      pageDe(payload, params, (row) => mapEvaluation(row)),
    ),

  evaluation: (id: string) => apiFetch<unknown>(`/api/evaluations/${id}`).then(mapEvaluation),

  creerEvaluation: (corps: EvaluationEnvoi) =>
    apiFetch<unknown>("/api/evaluations", {
      method: "POST",
      body: JSON.stringify({
        classeId: corps.classeId,
        matiereId: corps.matiereId,
        periodeId: corps.periodeId,
        enseignantId: corps.enseignantId || undefined,
        type: corps.type,
        libelle: corps.libelle,
        date: corps.date,
        noteMax: corps.noteMax,
        coefficient: corps.coefficient,
      }),
    }).then(mapEvaluation),

  modifierEvaluation: (id: string, corps: EvaluationEnvoi) =>
    apiFetch<unknown>(`/api/evaluations/${id}`, { method: "PATCH", body: JSON.stringify(corps) }).then(mapEvaluation),

  supprimerEvaluation: (id: string) => apiFetch<void>(`/api/evaluations/${id}`, { method: "DELETE" }),

  grille: (evaluationId: string) => chargerGrille(evaluationId),

  enregistrerNotes: async (evaluationId: string, lignes: LigneNoteEnvoi[]): Promise<EnregistrementNotes> => {
    const aSupprimer = lignes.filter((ligne) => ligne.supprimer);
    const aEcrire = lignes.filter((ligne) => !ligne.supprimer);
    for (const ligne of aSupprimer) {
      if (!ligne.noteId || ligne.version === null) continue;
      await apiFetch(`/api/notes/${ligne.noteId}`, {
        method: "DELETE",
        body: JSON.stringify({ version: ligne.version }),
      });
    }
    if (aEcrire.length > 0) {
      await apiFetch("/api/notes/lot", {
        method: "POST",
        body: JSON.stringify({
          evaluationId,
          lignes: aEcrire.map((ligne) => ({
            eleveId: ligne.eleveId,
            valeur: ligne.absent ? null : ligne.valeur,
            estAbsent: ligne.absent,
            commentaire: ligne.commentaire,
            version: ligne.version,
          })),
        }),
      });
    }
    return { message: "Notes enregistrées.", grille: await chargerGrille(evaluationId) };
  },

  resultats: (params: ListeParams) => chargerResultats(params),

  bulletin: async (eleveId: string, params: ListeParams): Promise<Bulletin> => {
    const document = rec(await apiFetch(listeQuery("/api/bulletins", versApi({ ...params, eleveId }))));
    const etablissement = await ignorerInterdit(api.etablissement(), {
      id: "",
      nom: "",
      adresse: "",
      telephone: "",
      email: "",
    });
    const eleve = rec(document.eleve);
    const classe = rec(document.classe);
    const periode = document.periode ? rec(document.periode) : null;
    const matieres = Array.isArray(document.lignes) ? document.lignes.map((ligne) => mapMatiereResultat(ligne)) : [];
    const session = await ignorerInterdit(api.session(), null);
    return {
      etablissement: { nom: etablissement.nom, adresse: etablissement.adresse },
      eleve: { id: str(eleve.id), matricule: str(eleve.matricule), nom: str(eleve.nom), prenom: str(eleve.prenom) },
      classe: { id: str(classe.id), nom: str(classe.nom), effectif: num(document.effectif) },
      periode: periode && str(periode.id) ? { id: str(periode.id), libelle: str(periode.libelle) } : null,
      matieres,
      moyenneGenerale: numOrNull(document.moyenneGenerale),
      rang: numOrNull(document.rang),
      appreciation: str(document.appreciation),
      appreciationGenerale: null,
      peutRedigerAppreciation: session?.utilisateur.role === "ADMIN" || session?.utilisateur.role === "PROFESSEUR_PRINCIPAL",
      matieresSansNote: matieres.filter((ligne) => ligne.moyenne === null).length,
      reduitAuxMatieres: document.moyenneGenerale === null && session?.utilisateur.role === "ENSEIGNANT",
    };
  },

  enregistrerAppreciation: (corps: AppreciationGeneraleEnvoi) =>
    apiFetch<{ texte: string }>("/api/appreciations-generales", { method: "PUT", body: JSON.stringify(corps) }),

  tableauDeBord: (anneeId: string | null) => chargerTableau(anneeId),

  distribution: (params: ListeParams) => chargerDistribution(params),

  moyennesMatieres: (params: ListeParams) => chargerMoyennesMatieres(params),

  evolution: (params: ListeParams) => chargerEvolution(params),

  sousSeuil: (params: ListeParams & { seuil?: number }) => chargerSousSeuil(params),

  utilisateurs: async () => (await apiFetch<unknown[]>("/api/utilisateurs")).map(mapUtilisateur),

  creerUtilisateur: async (corps: UtilisateurEnvoi): Promise<UtilisateurCree> => {
    const cree = mapUtilisateur(
      await apiFetch("/api/utilisateurs", {
        method: "POST",
        body: JSON.stringify({
          email: corps.email,
          motDePasse: corps.motDePasse,
          roleCode: corps.role,
          enseignantId: corps.enseignantId,
          prenom: corps.prenom,
          nom: corps.nom,
        }),
      }),
    );
    return { ...cree, motDePasseTemporaire: corps.motDePasse };
  },

  modifierUtilisateur: (
    id: string,
    corps: { actif: boolean; role: Utilisateur["role"]; enseignantId: string | null },
  ) =>
    apiFetch<unknown>(`/api/utilisateurs/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ actif: corps.actif, roleCode: corps.role, enseignantId: corps.enseignantId }),
    }).then(mapUtilisateur),

  motDePasseTemporaire: (id: string) =>
    apiFetch<MotDePasseTemporaire>(`/api/utilisateurs/${id}/mot-de-passe-temporaire`, { method: "POST" }),

  changerMotDePasse: (corps: { motDePasseActuel: string; nouveauMotDePasse: string }) =>
    apiFetch<void>("/api/profil/mot-de-passe", {
      method: "PATCH",
      body: JSON.stringify({ motDePasseActuel: corps.motDePasseActuel, motDePasse: corps.nouveauMotDePasse }),
    }),
};

function mapMatiereResultat(row: unknown) {
  const item = rec(row);
  return {
    matiereId: str(item.matiereId),
    nom: str(item.nom),
    coefficient: num(item.coefficient),
    moyenne: numOrNull(item.moyenne),
    appreciation: str(item.appreciation),
    rang: numOrNull(item.rang),
  };
}

function ficheMinimale(row: unknown): EleveFiche {
  const resume = mapEleve(row);
  const item = rec(row);
  return {
    ...resume,
    dateNaissance: strOrNull(item.dateNaissance),
    sexe: (strOrNull(item.sexe) as EleveFiche["sexe"]) ?? null,
    statut: "ACTIF",
    inscription: resume.classeId
      ? { id: "", classeId: resume.classeId, classeNom: resume.classe ?? "", statut: resume.statut }
      : null,
    resultats: null,
    historique: [],
  };
}

async function chargerGrille(evaluationId: string): Promise<GrilleNotes> {
  const evaluation = await api.evaluation(evaluationId);
  const [eleves, notes, session, annees] = await Promise.all([
    api.eleves({ classeId: evaluation.classeId, anneeId: evaluation.anneeScolaireId, page: 1, pageSize: 100 }),
    apiFetch<unknown>(listeQuery("/api/notes", versApi({ evaluationId, page: 1, pageSize: 100 }))),
    api.session(),
    api.annees(),
  ]);
  const parEleve = new Map<string, Brut>();
  for (const row of Array.isArray(rec(notes).data) ? (rec(notes).data as unknown[]) : []) {
    const item = rec(row);
    parEleve.set(str(item.eleveId), item);
  }
  const annee = annees.find((item) => item.id === evaluation.anneeScolaireId);
  const role = session.utilisateur.role;
  const fermee = annee?.statut === "CLOTUREE";
  const peutModifier = role === "ADMIN" || ((role === "ENSEIGNANT" || role === "PROFESSEUR_PRINCIPAL") && !fermee);
  const lignes: LigneGrille[] = eleves.items.map((eleve) => {
    const note = parEleve.get(eleve.id);
    return {
      eleveId: eleve.id,
      matricule: eleve.matricule,
      nom: eleve.nom,
      prenom: eleve.prenom,
      valeur: note ? numOrNull(note.valeur) : null,
      absent: note ? bool(note.estAbsent) : false,
      commentaire: note ? strOrNull(note.commentaire) : null,
      noteId: note ? strOrNull(note.id) : null,
      version: note ? strOrNull(note.version) : null,
    };
  });
  return {
    evaluation,
    peutModifier,
    motifLectureSeule: peutModifier ? null : fermee ? "Année clôturée." : "Lecture seule.",
    lignes,
  };
}

async function chargerResultats(params: ListeParams): Promise<ResultatsClasse> {
  const analyse = rec(await apiFetch(listeQuery("/api/analyses/classe", versApi(params))));
  const evolution = await ignorerInterdit(chargerEvolution(params), { points: [] });
  const appreciations = params.periodeId
    ? await ignorerInterdit(
        apiFetch<{ appreciations: { eleveId: string; texte: string }[] }>(
          listeQuery("/api/appreciations-generales", versApi({ classeId: params.classeId, periodeId: params.periodeId })),
        ),
        { appreciations: [] },
      )
    : { appreciations: [] };
  const texteParEleve = new Map(appreciations.appreciations.map((item) => [item.eleveId, item.texte]));
  const classe = rec(analyse.classe);
  const eleves = Array.isArray(analyse.eleves) ? analyse.eleves : [];
  const lignes: LigneResultat[] = eleves.map((row) => {
    const item = rec(row);
    const matieres = Array.isArray(item.matieres) ? item.matieres.map((matiere) => mapMatiereResultat(matiere)) : [];
    return {
      eleveId: str(item.eleveId),
      matricule: str(item.matricule),
      nom: str(item.nom),
      prenom: str(item.prenom),
      moyenneGenerale: numOrNull(item.moyenneGenerale),
      rang: numOrNull(item.rang),
      effectif: eleves.length,
      appreciation: str(item.appreciation),
      appreciationGenerale: texteParEleve.get(str(item.eleveId)) ?? null,
      matieresSansNote: matieres.filter((matiere) => matiere.moyenne === null).length,
      matieres,
      evolution: [],
    };
  });
  const session = await ignorerInterdit(api.session(), null);
  const role = session?.utilisateur.role;
  const periode = params.periodeId ? { id: params.periodeId, libelle: "" } : null;
  return {
    classe: { id: str(classe.id), nom: str(classe.nom), effectif: eleves.length },
    periode,
    peutRedigerAppreciation: role === "ADMIN" || role === "PROFESSEUR_PRINCIPAL",
    lignes,
    evolutionClasse: evolution.points,
  };
}

async function analyseEtablissement(params: ListeParams) {
  return rec(await apiFetch(listeQuery("/api/analyses/etablissement", versApi(params))));
}

function tranchesDe(stats: Brut): Distribution {
  const distribution = Array.isArray(stats.distribution) ? stats.distribution : [];
  return {
    tranches: distribution.map((row) => {
      const item = rec(row);
      return {
        libelle: str(item.libelle),
        min: num(item.min),
        max: numOrNull(item.max),
        effectif: num(item.effectif),
      };
    }),
  };
}

async function chargerDistribution(params: ListeParams): Promise<Distribution> {
  if (params.classeId) {
    const analyse = rec(await apiFetch(listeQuery("/api/analyses/classe", versApi(params))));
    return tranchesDe(rec(analyse.statistiques));
  }
  try {
    const etab = await analyseEtablissement(params);
    return tranchesDe(rec(etab.etablissement));
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 403) throw error;
    const classes = await api.classes({ anneeId: params.anneeId, page: 1, pageSize: 1 });
    if (!classes.items[0]) return { tranches: [] };
    return chargerDistribution({ ...params, classeId: classes.items[0].id });
  }
}

async function chargerMoyennesMatieres(params: ListeParams): Promise<MoyennesMatieres> {
  if (!params.classeId) return { matieres: [] };
  const matieres = params.matiereId
    ? [{ id: params.matiereId, nom: "" }]
    : (await api.matieres({ page: 1, pageSize: 100 })).items;
  const lignes = [];
  for (const matiere of matieres) {
    const detail = await ignorerInterdit(
      apiFetch<unknown>(
        listeQuery("/api/analyses/matiere", versApi({ ...params, matiereId: matiere.id })),
      ),
      null,
    );
    if (!detail) continue;
    const corps = rec(detail);
    const sujet = rec(corps.matiere);
    const stats = rec(corps.statistiques);
    lignes.push({
      matiereId: str(sujet.matiereId, matiere.id),
      nom: str(sujet.nom, "nom" in matiere ? matiere.nom : ""),
      moyenne: numOrNull(stats.moyenneClasse),
      effectif: num(stats.calculables),
    });
  }
  return { matieres: lignes };
}

async function chargerEvolution(params: ListeParams): Promise<EvolutionAnalyses> {
  if (params.classeId) {
    const corps = rec(await apiFetch(listeQuery("/api/analyses/temporelle", versApi({ classeId: params.classeId }))));
    const points = Array.isArray(corps.periodes) ? corps.periodes : [];
    return {
      points: points.map((row) => {
        const item = rec(row);
        const stats = rec(item.statistiques);
        return {
          periodeId: str(item.periodeId),
          libelle: str(item.libelle),
          moyenne: numOrNull(stats.moyenneClasse ?? item.moyenneGenerale),
          effectif: num(stats.effectif ?? stats.calculables),
        };
      }),
    };
  }
  try {
    const periodes = await api.periodes(params.anneeId ?? null);
    const points = [];
    for (const periode of periodes) {
      const etab = await analyseEtablissement({ ...params, periodeId: periode.id });
      const stats = rec(etab.etablissement);
      points.push({
        periodeId: periode.id,
        libelle: periode.libelle,
        moyenne: numOrNull(stats.moyenneClasse),
        effectif: num(stats.effectif),
      });
    }
    return { points };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 403) throw error;
    const classes = await api.classes({ anneeId: params.anneeId, page: 1, pageSize: 1 });
    if (!classes.items[0]) return { points: [] };
    return chargerEvolution({ ...params, classeId: classes.items[0].id });
  }
}

async function chargerSousSeuil(params: ListeParams & { seuil?: number }): Promise<SousSeuil> {
  const seuil = params.seuil ?? 10;
  if (!params.classeId) {
    const classes = await api.classes({ anneeId: params.anneeId, page: 1, pageSize: 100 });
    const eleves = [];
    for (const classe of classes.items) {
      const part = await chargerSousSeuil({ ...params, classeId: classe.id, seuil });
      eleves.push(...part.eleves.map((eleve) => ({ ...eleve, classe: classe.nom })));
    }
    return { seuil, effectif: eleves.length, eleves };
  }
  const analyse = rec(await apiFetch(listeQuery("/api/analyses/classe", versApi(params))));
  const classe = rec(analyse.classe);
  const eleves = (Array.isArray(analyse.eleves) ? analyse.eleves : [])
    .map((row) => rec(row))
    .filter((item) => {
      const moyenne = numOrNull(item.moyenneGenerale);
      return moyenne !== null && moyenne < seuil;
    })
    .map((item) => ({
      eleveId: str(item.eleveId),
      nom: str(item.nom),
      prenom: str(item.prenom),
      classe: str(classe.nom),
      moyenne: num(item.moyenneGenerale),
    }));
  return { seuil, effectif: eleves.length, eleves };
}

async function chargerTableau(anneeId: string | null): Promise<TableauDeBord> {
  const session = await api.session();
  const role = session.utilisateur.role;
  const [classes, evaluations, affectations] = await Promise.all([
    api.classes({ anneeId, page: 1, pageSize: 100 }),
    ignorerInterdit(api.evaluations({ anneeId, page: 1, pageSize: 100 }), { items: [], total: 0, page: 1, pageSize: 100 }),
    ignorerInterdit(api.affectations({ anneeId, page: 1, pageSize: 100 }), { items: [], total: 0, page: 1, pageSize: 100 }),
  ]);
  const indicateurs = [
    { id: "classes", libelle: "Classes", valeur: String(classes.total), href: "/classes" },
    { id: "evaluations", libelle: "Évaluations", valeur: String(evaluations.total), href: "/evaluations" },
  ];
  let classesEnDifficulte: TableauDeBord["classesEnDifficulte"] = [];
  let alerteSansDirection = false;
  if (role === "ADMIN" || role === "DIRECTION" || role === "CONSULTATION") {
    const etab = await ignorerInterdit(analyseEtablissement({ anneeId }), null);
    if (etab && Array.isArray(etab.classes)) {
      classesEnDifficulte = etab.classes
        .map((row) => {
          const item = rec(row);
          const stats = rec(item.statistiques);
          return { classeId: str(item.classeId), nom: str(item.nom), moyenne: numOrNull(stats.moyenneClasse) };
        })
        .filter((item) => item.moyenne !== null && item.moyenne < 10)
        .sort((a, b) => (a.moyenne ?? 0) - (b.moyenne ?? 0));
    }
  }
  if (role === "ADMIN") {
    const comptes = await ignorerInterdit(api.utilisateurs(), []);
    alerteSansDirection = !comptes.some((compte) => compte.role === "DIRECTION" && compte.actif);
    indicateurs.push({ id: "comptes", libelle: "Comptes", valeur: String(comptes.length), href: "/utilisateurs" });
  }
  return {
    indicateurs,
    evaluationsASaisir: evaluations.items
      .filter((item) => item.saisies < item.effectif)
      .map((item) => ({
        id: item.id,
        libelle: item.libelle,
        classe: item.classe,
        matiere: item.matiere,
        date: item.date,
        saisies: item.saisies,
        effectif: item.effectif,
      })),
    affectations: affectations.items.map((item) => ({ id: item.id, classe: item.classe, matiere: item.matiere })),
    dernierEnregistrement: null,
    appreciationsManquantes: null,
    classesEnDifficulte,
    alerteSansDirection,
  };
}

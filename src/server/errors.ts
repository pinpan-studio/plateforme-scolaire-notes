import { ZodError } from "zod";

export type ErrorDetail = {
  path: string;
  message: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];
  readonly retryAfter?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ErrorDetail[],
    retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

export function notFound(message = "Ressource introuvable."): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

export function forbidden(message = "Action interdite pour ce rôle."): ApiError {
  return new ApiError(403, "FORBIDDEN", message);
}

export function validationError(error: ZodError): ApiError {
  return new ApiError(
    422,
    "VALIDATION",
    "Données invalides.",
    error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join(".") : "(racine)",
      message: issue.message,
    })),
  );
}

type PgError = {
  code?: string;
  constraint_name?: string;
  message?: string;
};

const UNIQUE_MESSAGES: Record<string, string> = {
  eleve_matricule_unique: "Ce matricule existe déjà.",
  note_eleve_evaluation_unique: "Cette note existe déjà.",
  classe_annee_nom_unique: "Ce nom de classe existe déjà pour cette année.",
  matiere_code_unique: "Ce code de matière existe déjà.",
  matiere_nom_unique: "Ce nom de matière existe déjà.",
  utilisateur_email_unique: "Cet e-mail est déjà utilisé.",
  utilisateur_enseignant_unique: "Cet enseignant a déjà un compte.",
  enseignant_email_unique: "Cet e-mail d'enseignant existe déjà.",
  affectation_classe_matiere_annee_unique: "Cette classe a déjà un enseignant pour cette matière.",
  affectation_combinaison_unique: "Cette affectation existe déjà.",
  annee_scolaire_une_en_cours: "Une seule année peut être en cours.",
  annee_scolaire_etablissement_libelle_unique: "Ce libellé d'année existe déjà.",
  periode_annee_ordre_unique: "Ce trimestre existe déjà pour l'année.",
  periode_annee_libelle_unique: "Ce libellé de période existe déjà.",
  inscription_eleve_annee_unique: "Cet élève est déjà inscrit pour cette année.",
  niveau_code_unique: "Ce code de niveau existe déjà.",
};

const CHECK_MESSAGES: Array<[string, string]> = [
  ["note_depasse_maximum", "La note dépasse le barème de l'évaluation."],
  ["note_eleve_non_inscrit", "L'élève n'est pas inscrit dans la classe de l'évaluation."],
  ["evaluation_sans_affectation", "Aucun enseignant n'est affecté à cette classe et cette matière."],
  ["evaluation_hors_periode", "La date de l'évaluation est hors de la période."],
  ["evaluation_classe_autre_annee", "La période ne correspond pas à l'année de la classe."],
  ["periode_hors_annee", "Les dates de la période doivent être incluses dans l'année."],
  ["date_naissance_future", "La date de naissance doit être dans le passé."],
  ["pp_sans_classe", "Un professeur principal doit diriger au moins une classe."],
  ["affectation_annee_incoherente", "L'année de l'affectation doit être celle de la classe."],
  ["affectation_niveau_incoherent", "Cette matière n'est pas ouverte pour le niveau de la classe."],
  ["inscription_annee_incoherente", "L'année de l'inscription doit être celle de la classe."],
  ["note_valeur_non_negative", "La note ne peut pas être négative."],
  ["note_absence_coherente", "Une absence n'a pas de valeur, et une présence doit en avoir une."],
  ["matiere_coefficient_positif", "Le coefficient de matière doit être strictement positif."],
  ["evaluation_note_max_positive", "La note maximale doit être strictement positive et au plus 100."],
  ["evaluation_coefficient_positif", "Le coefficient d'évaluation doit être strictement positif."],
];

function postgresError(error: unknown): PgError | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const candidate = current as PgError;
    if (typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code)) return candidate;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export function fromDatabase(error: unknown): ApiError | null {
  const pg = postgresError(error);
  if (!pg?.code) return null;

  if (pg.code === "23505") {
    const message = (pg.constraint_name && UNIQUE_MESSAGES[pg.constraint_name]) || "Cet enregistrement existe déjà.";
    return new ApiError(409, "CONFLIT", message);
  }

  if (pg.code === "23503") {
    return new ApiError(409, "CONFLIT", "Suppression impossible : d'autres données en dépendent.");
  }

  if (pg.code === "23514") {
    const raw = pg.message ?? "";
    const known = CHECK_MESSAGES.find(([token]) => raw.includes(token));
    return new ApiError(422, "VALIDATION", known ? known[1] : "Les données ne respectent pas une règle de gestion.");
  }

  return null;
}

export function toErrorBody(error: ApiError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}

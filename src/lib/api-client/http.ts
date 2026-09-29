import type { ApiErrorBody, ListeParams } from "@/lib/api-client/types";

const MESSAGES: Record<string, string> = {
  IDENTIFIANTS_INVALIDES: "E-mail ou mot de passe incorrect.",
  COMPTE_DESACTIVE: "Ce compte est désactivé. Contactez l'administration.",
  SESSION_EXPIREE: "Votre session a expiré. Reconnectez-vous.",
  HORS_AFFECTATION: "Cette classe ou cette matière ne vous est pas affectée.",
  MATRICULE_DEJA_UTILISE: "Ce matricule est déjà attribué à un élève.",
  AFFECTATION_DOUBLON: "Cette affectation existe déjà.",
  NOTE_DOUBLON: "Cette note existe déjà. Rechargez la page.",
  SUPPRESSION_IMPOSSIBLE: "Des notes sont déjà saisies. La suppression est impossible.",
  PERIODE_CLOTUREE: "Période clôturée. Les notes ne sont plus modifiables.",
  NON_AUTHENTIFIE: "Votre session a expiré. Reconnectez-vous.",
};

export class ApiError extends Error {
  status: number;
  code: string;
  champs: { champ: string; message: string }[];

  constructor(status: number, code: string, message: string, champs: { champ: string; message: string }[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.champs = champs;
  }
}

export function messageUtilisateur(error: unknown, repli = "Impossible de charger les données."): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof TypeError) {
    return repli;
  }
  return repli;
}

export function listeQuery(path: string, params: ListeParams = {}): string {
  const search = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur === undefined || valeur === null || valeur === "") {
      continue;
    }
    search.set(cle, String(valeur));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(0, "RESEAU", "Impossible de charger les données.");
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const texte = await response.text();
  let payload: unknown = null;
  if (texte) {
    try {
      payload = JSON.parse(texte) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const corps = (payload ?? {}) as Partial<ApiErrorBody>;
    const code = typeof corps.code === "string" ? corps.code : "ERREUR";
    const message =
      typeof corps.message === "string" && corps.message.trim()
        ? corps.message
        : (MESSAGES[code] ?? "Impossible de charger les données.");
    throw new ApiError(response.status, code, message, corps.champs ?? []);
  }

  return payload as T;
}

export function indexErreurs(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) {
    return {};
  }
  return Object.fromEntries(error.champs.map((champ) => [champ.champ, champ.message]));
}

export function raisonInterdit(code: string): string {
  if (code === "HORS_AFFECTATION") {
    return "affectation";
  }
  return "role";
}

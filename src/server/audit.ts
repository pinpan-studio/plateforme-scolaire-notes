import { desc, eq } from "drizzle-orm";
import { journalAudit } from "@/db/schema";
import type { Database } from "./db";
import { getDb } from "./db";
import { ApiError } from "./errors";

export const AUDIT_TYPES = [
  "AUTH_SUCCES",
  "AUTH_ECHEC",
  "DECONNEXION",
  "NOTE_CREATION",
  "NOTE_MODIFICATION",
  "NOTE_SUPPRESSION",
  "NOTE_VALIDATION",
  "AUTORISATION_REFUSEE",
  "MOT_DE_PASSE",
  "UTILISATEUR_CREATION",
  "UTILISATEUR_MODIFICATION",
  "AFFECTATION_CREATION",
  "AFFECTATION_SUPPRESSION",
  "BAREME_MODIFICATION",
  "ANNEE_STATUT",
] as const;

export type AuditType = (typeof AUDIT_TYPES)[number];

export type AuditEntry = {
  type: AuditType;
  acteurId?: string | null;
  identifiant?: string | null;
  resultat: string;
  adresseIp?: string | null;
  action?: string | null;
  cibleType?: string | null;
  cibleId?: string | null;
  ancienneValeur?: string | null;
  nouvelleValeur?: string | null;
};

type Executor = Pick<Database, "insert">;

export function auditPour(
  acteur: { id: string; email: string },
  entry: Omit<AuditEntry, "acteurId" | "identifiant">,
): AuditEntry {
  return {
    acteurId: acteur.id,
    identifiant: acteur.email,
    ...entry,
  };
}

const CLES_SECRETES = new Set(["motdepasse", "mot_de_passe"]);

function cleSecrete(cle: string) {
  return CLES_SECRETES.has(cle.toLowerCase());
}

/** Clés `motDePasse` et `mot_de_passe`, y compris dans les objets imbriqués et les tableaux. */
function objetAvecCleSecrete(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(objetAvecCleSecrete);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([cle, enfant]) => cleSecrete(cle) || objetAvecCleSecrete(enfant));
}

function jsonStructure(value: string): unknown {
  const debut = value.trimStart();
  if (!debut.startsWith("{") && !debut.startsWith("[")) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Le journal ne reçoit ni hachage, ni mot de passe temporaire, ni jeton dans les valeurs avant/après.
 * Les clés `motDePasse` et `mot_de_passe` sont lues sur l'objet parsé, pas dans le texte JSON :
 * un e-mail peut commencer par « motdepasse » ou contenir « tmp- ».
 * L'identifiant n'est pas filtré. Le mot de passe temporaire généré est ancré en début de valeur (`Tmp-`).
 */
export function assertValeurAuditable(value: string | null | undefined) {
  if (!value) return;
  if (/^Tmp-/.test(value) || /\$2[aby]\$|bearer\s|eyJ[A-Za-z0-9_-]{8,}\./i.test(value)) {
    throw new ApiError(500, "ERREUR_INTERNE", "Une erreur interne est survenue.");
  }
  const structure = jsonStructure(value);
  if (structure !== undefined && objetAvecCleSecrete(structure)) {
    throw new ApiError(500, "ERREUR_INTERNE", "Une erreur interne est survenue.");
  }
}

export async function writeAudit(entry: AuditEntry, executor?: Executor) {
  assertValeurAuditable(entry.ancienneValeur);
  assertValeurAuditable(entry.nouvelleValeur);
  const db = executor ?? getDb();
  await db.insert(journalAudit).values({
    type: entry.type,
    acteurId: entry.acteurId ?? null,
    identifiant: entry.identifiant ?? null,
    resultat: entry.resultat,
    adresseIp: entry.adresseIp ?? null,
    action: entry.action ?? null,
    cibleType: entry.cibleType ?? null,
    cibleId: entry.cibleId ?? null,
    ancienneValeur: entry.ancienneValeur ?? null,
    nouvelleValeur: entry.nouvelleValeur ?? null,
  });
}

export function maskIdentifier(email: string): string {
  const [local, domain = ""] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function listAudit(limit: number) {
  return getDb()
    .select({
      id: journalAudit.id,
      type: journalAudit.type,
      acteurId: journalAudit.acteurId,
      identifiant: journalAudit.identifiant,
      resultat: journalAudit.resultat,
      adresseIp: journalAudit.adresseIp,
      action: journalAudit.action,
      cibleType: journalAudit.cibleType,
      cibleId: journalAudit.cibleId,
      ancienneValeur: journalAudit.ancienneValeur,
      nouvelleValeur: journalAudit.nouvelleValeur,
      createdAt: journalAudit.createdAt,
    })
    .from(journalAudit)
    .orderBy(desc(journalAudit.createdAt))
    .limit(limit);
}

export async function auditBelongsToActor(id: string, acteurId: string) {
  const [row] = await getDb()
    .select({ id: journalAudit.id })
    .from(journalAudit)
    .where(eq(journalAudit.id, id))
    .limit(1);
  return Boolean(row && acteurId);
}

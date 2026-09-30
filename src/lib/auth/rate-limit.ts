import { createHmac } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { limiteTentative } from "@/db/schema";
import { getDb } from "@/server/db";
import { ApiError } from "@/server/errors";
import { authSecret } from "./session";

const WINDOW_LOGIN_SECONDS = 15 * 60;
const WINDOW_PASSWORD_SECONDS = 15 * 60;
const WINDOW_VALIDATION_SECONDS = 60;
const MINUTE_MS = 60 * 1000;

const LOGIN_EMAIL = "connexion_email";
const LOGIN_IP = "connexion_ip";
const PASSWORD_SUBJECT = "mot_de_passe_sujet";
const PASSWORD_IP = "mot_de_passe_ip";
const VALIDATION_SUBJECT = "validation_sujet";
const VALIDATION_IP = "validation_ip";

type Bucket = { count: number; oldest: Date | null };

/**
 * Entier d'environnement borné. Une valeur absente ou hors plage retombe
 * sur le défaut : une coquille ne désactive pas la limite et n'en crée pas
 * une de zéro. Aucun secret n'est lu ici.
 */
function boundedInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return fallback;
  return value;
}

function loginConfig() {
  return {
    windowSeconds: boundedInt("AUTH_RATE_LIMIT_WINDOW_SECONDS", WINDOW_LOGIN_SECONDS, 1, 24 * 60 * 60),
    emailMax: boundedInt("AUTH_RATE_LIMIT_EMAIL_MAX", 5, 1, 1000),
    ipMax: boundedInt("AUTH_RATE_LIMIT_IP_MAX", 30, 1, 10_000),
  };
}

function passwordConfig() {
  return {
    windowSeconds: boundedInt("PASSWORD_RATE_LIMIT_WINDOW_SECONDS", WINDOW_PASSWORD_SECONDS, 1, 24 * 60 * 60),
    subjectMax: boundedInt("PASSWORD_RATE_LIMIT_MAX", 5, 1, 1000),
    ipMax: boundedInt("PASSWORD_RATE_LIMIT_IP_MAX", 30, 1, 10_000),
  };
}

function temporaryPasswordConfig() {
  return {
    windowSeconds: boundedInt("TEMP_PASSWORD_RATE_LIMIT_WINDOW_SECONDS", WINDOW_PASSWORD_SECONDS, 1, 24 * 60 * 60),
    subjectMax: boundedInt("TEMP_PASSWORD_RATE_LIMIT_MAX", 30, 1, 1000),
    ipMax: boundedInt("TEMP_PASSWORD_RATE_LIMIT_IP_MAX", 60, 1, 10_000),
  };
}

function validationConfig() {
  return {
    windowSeconds: boundedInt("VALIDATION_RATE_LIMIT_WINDOW_SECONDS", WINDOW_VALIDATION_SECONDS, 1, 24 * 60 * 60),
    subjectMax: boundedInt("VALIDATION_RATE_LIMIT_MAX", 30, 1, 1000),
    ipMax: boundedInt("VALIDATION_RATE_LIMIT_IP_MAX", 120, 1, 10_000),
  };
}

function digest(purpose: string, material: string): string {
  return createHmac("sha256", authSecret()).update(purpose).update("\0").update(material).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 200);
}

function normalizeIp(ip: string): string {
  const value = ip.trim().toLowerCase();
  if (value === "inconnue") return value;
  if (value.length === 0 || value.length > 64 || !/^[0-9a-f:.]+$/.test(value)) return "inconnue";
  return value;
}

/** Corps unique des 429. Pas de `details`, message sans détail technique. */
export const ERREUR_TROP_DE_TENTATIVES = {
  code: "TROP_DE_TENTATIVES",
  message: "Trop de tentatives. Réessayez plus tard.",
} as const;

function delaiSecondes(untilMs: number): number {
  const seconds = Math.ceil((untilMs - Date.now()) / 1000);
  if (!Number.isInteger(seconds) || seconds < 1) return 1;
  return seconds;
}

function rateLimited(oldest: Date | null, windowSeconds: number): never {
  const retryAfter = oldest ? delaiSecondes(oldest.getTime() + windowSeconds * 1000) : windowSeconds;
  throw new ApiError(429, ERREUR_TROP_DE_TENTATIVES.code, ERREUR_TROP_DE_TENTATIVES.message, undefined, retryAfter);
}

async function pruneExpired(): Promise<void> {
  const horizon = Math.max(
    loginConfig().windowSeconds,
    passwordConfig().windowSeconds,
    temporaryPasswordConfig().windowSeconds,
    validationConfig().windowSeconds,
  );
  await getDb().execute(sql`
    delete from limite_tentative
    where id in (
      select id from limite_tentative
      where created_at < now() - (cast(${horizon} as int) * interval '1 second')
      limit 200
    )
  `);
}

async function readBucket(portee: string, cle: string, windowSeconds: number): Promise<Bucket> {
  const rows = await getDb()
    .select({ createdAt: limiteTentative.createdAt })
    .from(limiteTentative)
    .where(
      and(
        eq(limiteTentative.portee, portee),
        eq(limiteTentative.cle, cle),
        sql`${limiteTentative.createdAt} > now() - (cast(${windowSeconds} as int) * interval '1 second')`,
      ),
    )
    .orderBy(asc(limiteTentative.createdAt));
  return { count: rows.length, oldest: rows[0]?.createdAt ?? null };
}

async function assertBuckets(input: {
  subjectPortee: string;
  subjectKey: string;
  subjectMax: number;
  ipPortee: string;
  ipKey: string;
  ipMax: number;
  windowSeconds: number;
}): Promise<void> {
  await pruneExpired();
  const subject = await readBucket(input.subjectPortee, input.subjectKey, input.windowSeconds);
  if (subject.count >= input.subjectMax) rateLimited(subject.oldest, input.windowSeconds);
  const network = await readBucket(input.ipPortee, input.ipKey, input.windowSeconds);
  if (network.count >= input.ipMax) rateLimited(network.oldest, input.windowSeconds);
}

async function insertHit(portee: string, cle: string, sujet: string | null): Promise<void> {
  await getDb().insert(limiteTentative).values({ portee, cle, sujet });
}

function loginEmailParts(email: string, ip: string) {
  const normalized = normalizeEmail(email);
  const address = normalizeIp(ip);
  return {
    cle: digest(LOGIN_EMAIL, `${normalized}|${address}`),
    sujet: digest(`${LOGIN_EMAIL}_sujet`, normalized),
    ipKey: digest(LOGIN_IP, address),
  };
}

/**
 * Connexion : un compteur pour le couple (e-mail, IP) et un compteur pour l'IP.
 * Le couple évite qu'un essai sur un compte bloque les autres, y compris les
 * comptes de démo, et qu'une autre adresse IP verrouille le compte.
 * Le compteur d'IP, plus haut, borne le bourrage d'identifiants depuis une seule adresse.
 */
export async function assertLoginAllowed(ip: string, email: string): Promise<void> {
  const limits = loginConfig();
  const parts = loginEmailParts(email, ip);
  await assertBuckets({
    subjectPortee: LOGIN_EMAIL,
    subjectKey: parts.cle,
    subjectMax: limits.emailMax,
    ipPortee: LOGIN_IP,
    ipKey: parts.ipKey,
    ipMax: limits.ipMax,
    windowSeconds: limits.windowSeconds,
  });
}

export async function recordLoginFailure(ip: string, email: string): Promise<void> {
  const parts = loginEmailParts(email, ip);
  await insertHit(LOGIN_EMAIL, parts.cle, parts.sujet);
  await insertHit(LOGIN_IP, parts.ipKey, null);
}

/** Oublie les échecs de cet e-mail, toutes IP confondues. Le compteur d'IP reste. */
export async function recordLoginSuccess(ip: string, email: string): Promise<void> {
  void ip;
  const sujet = loginEmailParts(email, "inconnue").sujet;
  await getDb()
    .delete(limiteTentative)
    .where(and(eq(limiteTentative.portee, LOGIN_EMAIL), eq(limiteTentative.sujet, sujet)));
}

function passwordParts(userId: string, ip: string) {
  const address = normalizeIp(ip);
  return {
    cle: digest(PASSWORD_SUBJECT, `${userId}|${address}`),
    sujet: digest(`${PASSWORD_SUBJECT}_sujet`, userId),
    ipKey: digest(PASSWORD_IP, address),
  };
}

export async function assertPasswordChangeAllowed(userId: string, ip: string): Promise<void> {
  const limits = passwordConfig();
  const parts = passwordParts(userId, ip);
  await assertBuckets({
    subjectPortee: PASSWORD_SUBJECT,
    subjectKey: parts.cle,
    subjectMax: limits.subjectMax,
    ipPortee: PASSWORD_IP,
    ipKey: parts.ipKey,
    ipMax: limits.ipMax,
    windowSeconds: limits.windowSeconds,
  });
}

export async function recordPasswordChangeAttempt(userId: string, ip: string): Promise<void> {
  const parts = passwordParts(userId, ip);
  await insertHit(PASSWORD_SUBJECT, parts.cle, parts.sujet);
  await insertHit(PASSWORD_IP, parts.ipKey, null);
}

export async function recordPasswordChangeSuccess(userId: string): Promise<void> {
  const sujet = passwordParts(userId, "inconnue").sujet;
  await getDb()
    .delete(limiteTentative)
    .where(and(eq(limiteTentative.portee, PASSWORD_SUBJECT), eq(limiteTentative.sujet, sujet)));
}

const TEMP_SUBJECT = "mot_de_passe_temporaire";
const TEMP_IP = "mot_de_passe_temporaire_ip";

/**
 * Mot de passe temporaire : mêmes portées que le changement de mot de passe,
 * clés HMAC distinctes. Le plafond (défaut 30 / 60 / 15 min) ne partage pas
 * le compteur des 5 essais. Chaque émission compte, y compris un succès.
 */
function temporaryPasswordParts(actorId: string, ip: string) {
  const address = normalizeIp(ip);
  return {
    cle: digest(TEMP_SUBJECT, `${actorId}|${address}`),
    sujet: digest(`${TEMP_SUBJECT}_sujet`, actorId),
    ipKey: digest(TEMP_IP, address),
  };
}

export async function assertTemporaryPasswordAllowed(actorId: string, ip: string): Promise<void> {
  const limits = temporaryPasswordConfig();
  const parts = temporaryPasswordParts(actorId, ip);
  await assertBuckets({
    subjectPortee: PASSWORD_SUBJECT,
    subjectKey: parts.cle,
    subjectMax: limits.subjectMax,
    ipPortee: PASSWORD_IP,
    ipKey: parts.ipKey,
    ipMax: limits.ipMax,
    windowSeconds: limits.windowSeconds,
  });
}

export async function recordTemporaryPasswordAttempt(actorId: string, ip: string): Promise<void> {
  const parts = temporaryPasswordParts(actorId, ip);
  await insertHit(PASSWORD_SUBJECT, parts.cle, parts.sujet);
  await insertHit(PASSWORD_IP, parts.ipKey, null);
}

function validationParts(userId: string, ip: string) {
  const address = normalizeIp(ip);
  return {
    cle: digest(VALIDATION_SUBJECT, userId),
    sujet: digest(`${VALIDATION_SUBJECT}_sujet`, userId),
    ipKey: digest(VALIDATION_IP, address),
  };
}

/**
 * Validation de notes : un compteur par utilisateur de session (toutes IP)
 * et un compteur par IP. Chaque appel autorisé consomme les deux.
 */
export async function consumeValidationAttempt(userId: string, ip: string): Promise<void> {
  const limits = validationConfig();
  const parts = validationParts(userId, ip);
  await assertBuckets({
    subjectPortee: VALIDATION_SUBJECT,
    subjectKey: parts.cle,
    subjectMax: limits.subjectMax,
    ipPortee: VALIDATION_IP,
    ipKey: parts.ipKey,
    ipMax: limits.ipMax,
    windowSeconds: limits.windowSeconds,
  });
  await insertHit(VALIDATION_SUBJECT, parts.cle, parts.sujet);
  await insertHit(VALIDATION_IP, parts.ipKey, null);
}

const writeBuckets = new Map<string, number[]>();
const searchBuckets = new Map<string, number[]>();

function hit(bucket: Map<string, number[]>, key: string, limit: number): void {
  const now = Date.now();
  const recent = (bucket.get(key) ?? []).filter((stamp) => now - stamp < MINUTE_MS);
  if (recent.length >= limit) {
    bucket.set(key, recent);
    const oldest = recent[0] ?? now;
    rateLimited(new Date(oldest), 60);
  }
  recent.push(now);
  bucket.set(key, recent);
}

export function assertWriteRate(userId: string): void {
  hit(writeBuckets, userId, 60);
}

export function assertSearchRate(userId: string): void {
  hit(searchBuckets, userId, 30);
}

export async function resetRateLimits(): Promise<void> {
  writeBuckets.clear();
  searchBuckets.clear();
  await getDb().delete(limiteTentative);
}

import { decode, encode } from "@auth/core/jwt";
import { appUsesHttps } from "@/lib/app-url";
import { eq } from "drizzle-orm";
import { utilisateur } from "@/db/schema";
import { getDb } from "@/server/db";
import { ApiError } from "@/server/errors";
import { isRole, type Role, type SessionUser } from "./permissions";

/** Durée absolue de la session, sans glissement. */
export const SESSION_MAX_AGE = 8 * 60 * 60;

export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new ApiError(500, "CONFIGURATION", "Configuration d'authentification indisponible.");
  }
  return secret;
}

export function secureCookies(request?: Request): boolean {
  if (appUsesHttps()) return true;
  return request?.headers.get("x-forwarded-proto") === "https";
}

export function sessionCookieName(secure: boolean): string {
  return secure ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export type SessionClaims = SessionUser & {
  sessionVersion: number;
};

export async function createSessionToken(
  claims: SessionClaims,
  options?: { maxAge?: number; secure?: boolean },
): Promise<string> {
  const secure = options?.secure ?? secureCookies();
  const salt = sessionCookieName(secure);
  return encode({
    token: {
      sub: claims.id,
      email: claims.email,
      role: claims.role,
      enseignantId: claims.enseignantId,
      prenom: claims.prenom,
      nom: claims.nom,
      sv: claims.sessionVersion,
    },
    secret: authSecret(),
    salt,
    maxAge: options?.maxAge ?? SESSION_MAX_AGE,
  });
}

export function serializeSessionCookie(token: string, request?: Request, maxAge = SESSION_MAX_AGE): string {
  const secure = secureCookies(request);
  const name = sessionCookieName(secure);
  const parts = [`${name}=${token}`, "HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(request?: Request): string {
  return serializeSessionCookie("", request, 0);
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key === name) return part.slice(separator + 1).trim();
  }
  return null;
}

export async function requireSession(request: Request): Promise<SessionUser> {
  const secure = secureCookies(request);
  const name = sessionCookieName(secure);
  const token = readCookie(request, name) ?? readCookie(request, sessionCookieName(!secure));
  if (!token) {
    throw new ApiError(401, "UNAUTHENTICATED", "Authentification requise.");
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await decode({
      token,
      secret: authSecret(),
      salt: name,
    })) as Record<string, unknown> | null;
  } catch {
    payload = null;
  }

  if (!payload && token) {
    try {
      payload = (await decode({
        token,
        secret: authSecret(),
        salt: sessionCookieName(!secure),
      })) as Record<string, unknown> | null;
    } catch {
      payload = null;
    }
  }

  const id = typeof payload?.sub === "string" ? payload.sub : null;
  const version = typeof payload?.sv === "number" ? payload.sv : null;
  const role = typeof payload?.role === "string" && isRole(payload.role) ? payload.role : null;
  if (!payload || !id || version === null || !role) {
    throw new ApiError(401, "UNAUTHENTICATED", "Authentification requise.");
  }

  const [row] = await getDb()
    .select({
      id: utilisateur.id,
      email: utilisateur.email,
      roleCode: utilisateur.roleCode,
      enseignantId: utilisateur.enseignantId,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      actif: utilisateur.actif,
      sessionVersion: utilisateur.sessionVersion,
    })
    .from(utilisateur)
    .where(eq(utilisateur.id, id))
    .limit(1);

  if (!row || !row.actif || row.sessionVersion !== version || !isRole(row.roleCode) || row.roleCode !== role) {
    throw new ApiError(401, "UNAUTHENTICATED", "Authentification requise.");
  }

  return {
    id: row.id,
    email: row.email,
    role: row.roleCode as Role,
    enseignantId: row.enseignantId,
    prenom: row.prenom,
    nom: row.nom,
  };
}

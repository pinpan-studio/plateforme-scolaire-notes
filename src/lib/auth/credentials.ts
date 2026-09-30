import { eq } from "drizzle-orm";
import { utilisateur } from "@/db/schema";
import { getDb } from "@/server/db";
import { maskIdentifier, writeAudit } from "@/server/audit";
import { verifyPassword } from "./password";
import { isRole, type Role } from "./permissions";
import { assertLoginAllowed, recordLoginFailure, recordLoginSuccess } from "./rate-limit";
import { clearSessionCookie, createSessionToken, serializeSessionCookie } from "./session";

export type AuthResult =
  | {
      status: "ok";
      token: string;
      utilisateur: {
        id: string;
        email: string;
        role: Role;
        enseignantId: string | null;
        prenom: string;
        nom: string;
      };
    }
  | { status: "invalid" }
  | { status: "disabled" };

export async function authenticate(
  email: string,
  password: string,
  ip: string,
  secure = false,
): Promise<AuthResult> {
  await assertLoginAllowed(ip, email);
  const normalized = email.trim().toLowerCase();
  const [row] = await getDb()
    .select({
      id: utilisateur.id,
      email: utilisateur.email,
      motDePasseHash: utilisateur.motDePasseHash,
      roleCode: utilisateur.roleCode,
      enseignantId: utilisateur.enseignantId,
      prenom: utilisateur.prenom,
      nom: utilisateur.nom,
      actif: utilisateur.actif,
      sessionVersion: utilisateur.sessionVersion,
    })
    .from(utilisateur)
    .where(eq(utilisateur.email, normalized))
    .limit(1);

  const passwordOk = await verifyPassword(password, row?.motDePasseHash ?? null);
  if (!row || !passwordOk || !isRole(row.roleCode)) {
    await recordLoginFailure(ip, normalized);
    await writeAudit({
      type: "AUTH_ECHEC",
      identifiant: maskIdentifier(normalized),
      resultat: "401",
      adresseIp: ip,
      action: "LOGIN",
    });
    return { status: "invalid" };
  }

  if (!row.actif) {
    await writeAudit({
      type: "AUTH_ECHEC",
      acteurId: row.id,
      identifiant: row.email,
      resultat: "403",
      adresseIp: ip,
      action: "LOGIN",
    });
    return { status: "disabled" };
  }

  await recordLoginSuccess(ip, normalized);
  const sessionVersion = row.sessionVersion + 1;
  await getDb().update(utilisateur).set({ sessionVersion }).where(eq(utilisateur.id, row.id));

  const profile = {
    id: row.id,
    email: row.email,
    role: row.roleCode,
    enseignantId: row.enseignantId,
    prenom: row.prenom,
    nom: row.nom,
  };
  const token = await createSessionToken({ ...profile, sessionVersion }, { secure });
  await writeAudit({
    type: "AUTH_SUCCES",
    acteurId: row.id,
    identifiant: row.email,
    resultat: "200",
    adresseIp: ip,
    action: "LOGIN",
  });
  return { status: "ok", token, utilisateur: profile };
}

export async function revokeSession(userId: string, ip: string) {
  const [row] = await getDb()
    .select({ sessionVersion: utilisateur.sessionVersion, email: utilisateur.email })
    .from(utilisateur)
    .where(eq(utilisateur.id, userId))
    .limit(1);
  if (!row) return;
  await getDb()
    .update(utilisateur)
    .set({ sessionVersion: row.sessionVersion + 1 })
    .where(eq(utilisateur.id, userId));
  await writeAudit({
    type: "DECONNEXION",
    acteurId: userId,
    identifiant: row.email,
    resultat: "200",
    adresseIp: ip,
    action: "LOGOUT",
  });
}

export function sessionCookie(token: string, request: Request) {
  return serializeSessionCookie(token, request);
}

export function clearedCookie(request: Request) {
  return clearSessionCookie(request);
}

import bcrypt from "bcryptjs";
import { DEMO_PASSWORD_HASH } from "@/db/demo-password";

/** Coût bcrypt des mots de passe créés par l'API. Le seed de démo reste déterministe. */
export const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Compare toujours avec bcrypt, y compris si le compte n'existe pas,
 * pour ne pas distinguer un identifiant inconnu d'un mot de passe faux.
 */
export function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DEMO_PASSWORD_HASH);
}

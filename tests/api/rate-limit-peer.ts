/**
 * Deuxième instance : processus séparé, même base, mémoire vide.
 * Les arguments sont une IP de test, un e-mail de test et un nombre d'échecs.
 * Ne journalise ni mot de passe, ni jeton, ni e-mail.
 */
import { recordLoginFailure } from "@/lib/auth/rate-limit";

const ip = process.argv[2] ?? "";
const email = process.argv[3] ?? "";
const times = Number(process.argv[4] ?? "");

async function main() {
  if (!ip || !email || !Number.isInteger(times) || times < 1 || times > 20) {
    process.exit(2);
  }
  for (let index = 0; index < times; index += 1) {
    await recordLoginFailure(ip, email);
  }
  process.exit(0);
}

main().catch(() => {
  process.exit(1);
});

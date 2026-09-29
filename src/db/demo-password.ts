/**
 * Compte de démonstration uniquement.
 * Le mot de passe en clair est documenté dans le README.
 * Ce n'est pas un secret de production : aucun déploiement réel ne doit le conserver.
 */
export const DEMO_PASSWORD = "Demo-2026!";

/**
 * Hachage factice (bcrypt, coût 12) utilisé seulement pour comparer
 * un mot de passe quand le compte n'existe pas. Il n'est stocké pour personne.
 */
export const DEMO_PASSWORD_HASH =
  "$2b$12$FO4KgVQ4XDseHgm4rbnkdeQQwIOVmR/8KOlEgMNhkAwQILK7Pl4Z6";

/** Un sel par compte de démonstration. Même mot de passe, hachages distincts, coût 12. */
export const DEMO_PASSWORD_HASHES: Record<string, string> = {
  "admin@tilleuls.demo": "$2b$12$9FK6qnsV2PesbvmfQ88eJenH1SDPNJTMBQOdTaTr0wT8m4HplKSa.",
  "direction@tilleuls.demo": "$2b$12$bqNfWCxYeYMUhAukUjFgLOnb2iqw569Zq6OZO7BYqDAcaQA9xDE3.",
  "nathan.durand@tilleuls.demo": "$2b$12$EaUcd5QA7x8nSw7x09dMQu3kKHaNp1uF8qMEU71JJ8GfptbtwJVCO",
  "camille.martin@tilleuls.demo": "$2b$12$hEs1u2WnJks/BcCyKICDzuAYfhYlEmUQOJKFSKhcsMTRMZXs3MvPy",
  "consultation@tilleuls.demo": "$2b$12$WRiCOXyMfHynpiCSvjOCPesqLRhfAV2pBMkYneCl3pZded3yCACvm",
};

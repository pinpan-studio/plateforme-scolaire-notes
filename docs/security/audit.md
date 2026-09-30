# Audit de sécurité

Revue faite sur la branche d'intégration, contre PostgreSQL local et le code servi par l'application. La grille est [checklist-securite.md](checklist-securite.md). Les comptes du plan (`admin@etab.test`, `scolarite`, `eleve`) n'existent pas : le schéma réel est `ADMIN`, `DIRECTION`, `ENSEIGNANT`, `PROFESSEUR_PRINCIPAL`, `CONSULTATION`, avec les comptes `*@tilleuls.demo`.

## Problèmes détectés et corrigés

| Problème | Correction |
| --- | --- |
| Les cinq comptes de démonstration partageaient un seul hachage bcrypt de coût 10. | Un hachage de coût 12 et un sel distinct par compte (`src/db/demo-password.ts`). Le hachage factice utilisé quand l'identifiant est inconnu n'est stocké pour personne. Les mots de passe créés par l'API restent au coût 12. |
| `PATCH /api/utilisateurs/:id` changeait le mot de passe sans incrémenter `session_version`. L'ancienne session restait valable. | La version de session est incrémentée quand le mot de passe change. La déconnexion et le mot de passe temporaire le faisaient déjà. |
| La limite de 30 recherches par minute ne couvrait que la liste des élèves. | Le même compteur s'applique à la recherche des classes, des évaluations et des matières. |
| `GET /api/health` ne prouvait pas que la base répondait. | La route exécute `select 1` et renvoie `database: ok` ou `503`. |
| Limite de connexion en mémoire, par instance, sans remise à zéro de la fenêtre. Les changements de mot de passe n'étaient pas bornés. `POST /api/notes/valider` n'était pas borné et écrivait une ligne d'audit à chaque appel. | Compteurs dans `limite_tentative` (migration `0003`), fenêtre glissante, couple e-mail+IP et IP, remise à zéro après succès ou expiration. Même limiteur sur les routes de mot de passe et sur la validation (utilisateur de session et IP). L'audit de validation ne garde qu'un passage par état. |

## Contrôles vérifiés

Preuves dans `tests/api/auth.test.ts`, `tests/api/notes.test.ts`, `tests/api/securite.test.ts` et `tests/api/parcours.test.ts`, exécutés sur l'API réelle.

- Connexion valide, refus identique pour mot de passe faux et compte inconnu (`401`, message « Identifiants invalides »), compte désactivé `403` puis ancien cookie `401`.
- Déconnexion et nouvelle connexion révoquent le cookie précédent via `session_version`. Session expirée : `401`. Durée absolue : 8 heures (`SESSION_MAX_AGE`).
- Sixième essai de connexion : `429` et `Retry-After`. Un autre identifiant depuis la même clé n'est pas bloqué. Le corps du `429` ne dit pas si le compte existe.
- Origine `https://evil.example` sur une écriture : `403`. Cookie `HttpOnly`, `SameSite=Lax`, `Path=/`. `Secure` est ajouté quand `APP_URL` ou `AUTH_URL` est en `https`, ou quand `x-forwarded-proto` vaut `https`. En HTTP local, `Secure` est absent : exception de développement, pas le mode Vercel.
- En-têtes : `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, CSP sans `script-src *`. En production le middleware pose un nonce et `strict-dynamic` pour que Next.js hydrate les pages sans `unsafe-inline` sur les scripts. `unsafe-eval` n'est ajouté qu'en `NODE_ENV=development` (serveur Next). `style-src 'unsafe-inline'` couvre le CSS injecté par Next.js. `X-Powered-By` retiré. HSTS (`max-age=15552000`) en production et dans `vercel.json`. La CSP des pages n'est pas dupliquée dans `vercel.json`, pour ne pas annuler le nonce.
- Enseignant `nathan.durand` : `PATCH` d'une note de français hors affectation `403`, valeur inchangée, `GET` des notes de cette évaluation `403` sans champ `valeur`. Le lot de notes d'une évaluation non affectée est refusé en entier (`parcours`, intrusion `403`). Direction et consultation ne créent pas de note (`403`). Sans cookie : `401`.
- Année clôturée : l'enseignant reçoit `403` sur la modification d'une note.
- Réponses de connexion, de session et de `GET /api/utilisateurs` : aucune occurrence de `motDePasseHash`, `$2a$` / `$2b$`, `AUTH_SECRET` ou `DATABASE_URL`.
- Recherche : le filtre `q` passe par un paramètre Drizzle (`ilike`), les jokers `%`, `_` et `\` sont échappés, la 31e recherche renvoie `429`. Une valeur `' OR 1=1 --` ne provoque pas d'erreur SQL.
- `AUTH_SECRET` de moins de 32 caractères refuse de signer une session (`500` contrôlé, pas de cookie).
- Les triggers SQL viennent d'un fichier du dépôt (`drizzle/triggers.sql`), pas d'une entrée utilisateur. `sql.raw` du seed est une commande `TRUNCATE` fixe.

## Dépôt et historique

Recherche sur l'arbre et sur l'historique git : pas de clé `sk_live` / `sk_test`, pas de clé AWS, pas de clé privée. Les seules URL `postgresql://` sont le placeholder local `notes:notes@127.0.0.1` (`.env.example`, config Drizzle, tests). `.env` est ignoré et n'est pas versionné. `.env.example` ne contient que `change-me-minimum-32-characters-long`.

Le mot de passe `Demo-2026!` et ses hachages sont des fixtures de démonstration, documentées dans le README. Ce ne sont pas des secrets de production. Le secret de test Vitest (`test-auth-secret-at-least-32-characters`) non plus : il ne signe aucune session déployée.

## Problèmes restants

| Sévérité | Sujet | État |
| --- | --- | --- |
| Majeur | Le lot de notes n'a pas de contrôle de version. Deux enregistrements rapprochés : le dernier écrase, sans `409`. Le `PATCH` unitaire, lui, compare `version`. | Ouvert. |
| Majeur | Pas de rôle élève. `CONSULTATION` lit les notes de l'établissement. La matrice « élève / ses notes seulement » de la checklist ne s'applique pas. | Écart de modèle, assumé. |
| Majeur | `DIRECTION` lit les notes mais ne crée pas d'élève (`403`). La checklist attendait un rôle scolarité autorisé à créer un élève. | Écart de modèle, assumé. Le test de parcours l'affirme. |
| Majeur | Sauvegardes et chiffrement au repos : non réglés dans ce dépôt. Neon les fournit au niveau de l'hébergeur ; aucune preuve d'un réglage de projet. | Ouvert jusqu'au branchement Neon. |
| Majeur | Séparation Preview / Production des hôtes `DATABASE_URL` : à faire dans Vercel au moment du déploiement. Le guide est dans `docs/deploiement.md`. | Ouvert, pas de déploiement dans cette revue. |
| Mineur | L'interface marque la grille modifiable pour un enseignant dès que l'année est ouverte, y compris hors matière. L'enregistrement est refusé par l'API (`403`). | Le contrôle serveur tient. L'affichage du bouton reste trop large. |
| Mineur | `vercel.json` envoie HSTS sur toutes les réponses du déploiement. Cohérent avec HTTPS Vercel. Inutile en HTTP local, où l'en-tête n'est pas produit par l'application. | Documenté. |
| Mineur | Le tableau de bord ne compte pas les appréciations manquantes (`null`, pas un faux zéro). | Fonctionnel, pas une fuite. |

## Campagne exécutée

- `npm run lint` : succès, aucune erreur.
- `npm test` : **185 réussis, 0 échoué**. Détail : 22 tests Node (jeu de démonstration, contraintes SQL, formules de `src/lib/grading/`) puis 163 tests Vitest (API, module de calcul, composants).
- `npm run build` : succès. Next.js signale que le fichier `middleware` est déprécié au profit de `proxy`. Les en-têtes partent quand même (la sortie de build les classe comme proxy).
- Playwright (`npx playwright test`, Chromium, serveur `next start`) : **3 réussis, 0 échoué** — connexion, consultation des résultats, saisie d'une note.

## Hors échec

Le seed de démonstration ne contient que des personnes fictives. Aucune route de réinitialisation par jeton n'existe : un administrateur émet un mot de passe temporaire, renvoyé une seule fois dans la réponse, haché en base, absent du journal d'audit (`MOT_DE_PASSE` sans valeur).

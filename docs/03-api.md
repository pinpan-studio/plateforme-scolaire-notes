# API — cahier de notes

Route Handlers Next.js, runtime Node.js, sous `/api`. Les écritures sont validées par Zod avant tout accès métier. Les requêtes SQL passent par Drizzle (paramètres liés). Les moyennes, rangs et appréciations viennent de `src/lib/grading/` : les routes ne recopient pas les formules.

Document lié : [analyse fonctionnelle](01-analyse-fonctionnelle.md) (matrice des rôles), [architecture](02-architecture.md), [checklist de sécurité](security/checklist-securite.md).

## 1. Session

Auth.js, fournisseur Credentials, session JWT chiffrée (A256CBC-HS512) signée avec `AUTH_SECRET` (32 caractères minimum). Pas de table de session : la révocation s'appuie sur `utilisateur.session_version`, incrémenté à chaque connexion et à la déconnexion. Chaque requête relit le compte : un compte désactivé ou un jeton d'une version antérieure reçoit `401`.

Durée absolue : 8 heures, sans glissement. Cookie `authjs.session-token` (`__Secure-authjs.session-token` si `APP_URL` est en HTTPS) : `HttpOnly`, `Path=/`, `SameSite=Lax`, `Max-Age=28800`. `Secure` est posé dès que l'origine est HTTPS. En HTTP local, l'attribut est absent : cette exception ne s'applique pas aux déploiements Vercel.

Le mot de passe de démonstration `Demo-2026!` n'est pas un secret de production. La connexion accepte ce mot de passe historique. Les comptes créés ou modifiés par l'API exigent au moins 12 caractères et sont hachés en bcrypt, coût 12, sel unique. Le seed reste déterministe : un même hash de coût 10 est partagé par les cinq comptes de démo (`src/db/demo-password.ts`).

| Méthode | Route | Auth | Rôle |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | non | — |
| POST | `/api/auth/logout` | oui | tous |
| GET | `/api/auth/session` | oui | tous |

La connexion, la déconnexion et la session passent uniquement par ces trois routes. Le rattrapage Auth.js `/api/auth/[...nextauth]` n'est pas monté : l'application ne l'utilise pas, et il authentifiait tous les clients sous l'adresse IP constante `authjs`. Le cookie conserve le nom `authjs.session-token` : le jeton est produit par `@auth/core/jwt`.

Connexion :

```json
{ "email": "admin@tilleuls.demo", "motDePasse": "Demo-2026!" }
```

Réponse `200` : `{ "utilisateur": { "id", "email", "role", "enseignantId", "prenom", "nom" } }` et `Set-Cookie`. Le corps ne contient ni mot de passe, ni hachage, ni jeton.

Échec : mot de passe faux et identifiant inconnu renvoient le même `401` `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Identifiants invalides." } }`. Compte inactif avec le bon mot de passe : `403` `ACCOUNT_DISABLED`. Les compteurs sont dans Postgres (`limite_tentative`), partagés entre les instances. Fenêtre glissante (défaut 15 minutes, `AUTH_RATE_LIMIT_WINDOW_SECONDS`) : les essais périmés ne comptent plus et les lignes expirées sont supprimées. Cinq échecs (`AUTH_RATE_LIMIT_EMAIL_MAX`) pour le couple (adresse IP, e-mail) bloquent le sixième essai en `429`, en-tête `Retry-After`, y compris si le mot de passe devient correct. Une connexion réussie remet à zéro les échecs de cet e-mail. Un autre e-mail depuis la même IP n'est pas bloqué par ce seul couple. Une même IP est aussi bornée tous e-mails confondus (`AUTH_RATE_LIMIT_IP_MAX`, défaut 30) pour limiter le bourrage d'identifiants sans verrouiller les comptes de démo entre eux. Une autre IP ne verrouille pas le compte.

## 2. Erreurs

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "Données invalides.",
    "details": [{ "path": "matricule", "message": "Le matricule contient au moins 4 caractères." }]
  }
}
```

| Statut | Code | Cas |
| --- | --- | --- |
| 400 | `JSON_INVALIDE` | Corps qui n'est pas du JSON |
| 401 | `UNAUTHENTICATED` | Session absente, expirée, révoquée ou compte désactivé après émission |
| 403 | `FORBIDDEN` | Rôle ou affectation insuffisante |
| 403 | `ANNEE_CLOTUREE` | Écriture sur une année close, hors administrateur |
| 403 | `CSRF` | `Origin` hostile ou `Sec-Fetch-Site: cross-site` |
| 403 | `ACCOUNT_DISABLED` | Connexion d'un compte inactif |
| 404 | `NOT_FOUND` | Identifiant inconnu |
| 409 | `CONFLIT` | Unicité, version périmée, suppression encore référencée |
| 422 | `VALIDATION` | Zod, barème, inscription, règle de gestion |
| 429 | `TROP_DE_TENTATIVES` | Connexion, changement de mot de passe, mot de passe temporaire, validation de notes, recherche ou écriture de notes |
| 500 | `ERREUR_INTERNE` | Message générique, sans pile ni SQL |

Le `429` est identique sur toutes ces routes. En-tête `Retry-After` : entier de secondes. Corps, sans `details` :

```json
{
  "error": {
    "code": "TROP_DE_TENTATIVES",
    "message": "Trop de tentatives. Réessayez plus tard."
  }
}
```

Les objets JSON sont stricts : une propriété inconnue (`role` sur un élève) est un `422`. Les identifiants sont des UUID. Une recherche `q` de plus de 80 caractères est un `422`. Le tri (`sort`) est une liste blanche (`nom`, `prenom`, `matricule`).

## 3. Matrice appliquée

| Action | ADMIN | DIRECTION | ENSEIGNANT | PROFESSEUR_PRINCIPAL | CONSULTATION |
| --- | --- | --- | --- | --- | --- |
| Référentiel (établissement, matières, enseignants, affectations, comptes) | écriture | lecture | lecture filtrée sur ses affectations | lecture de sa classe et de ses affectations | lecture des matières, classes et affectations |
| Années et périodes | écriture | écriture | lecture | lecture | lecture |
| Élèves et inscriptions | écriture | lecture | lecture des classes affectées | lecture de sa classe et de ses affectations | lecture |
| Évaluations et notes | écriture, y compris année close | lecture | écriture dans l'affectation classe+matière, année ouverte | écriture limitée à ses affectations ; lecture de toute sa classe | lecture |
| Bulletin et analyses | tout | tout | ses matières | sa classe et ses matières | tout |
| Tableau de bord établissement | oui | oui | non | non | oui |
| Journal d'audit | lecture | non | non | non | non |

Un professeur principal ne saisit pas les notes de ses collègues. Une année `CLOTUREE` refuse toute écriture de note ou d'évaluation sauf `ADMIN`.

La lecture d'une note hors périmètre est un `403` dont le corps ne contient pas la valeur. Un lot qui mélange une ligne autorisée et une ligne hors périmètre est rejeté en entier (`403`), sans écriture. Une ligne invalide (barème, absence contradictoire, élève hors classe) rejette le lot en `422`, sans écriture.

Les suppressions qui casseraient des données sont des `409` : élève qui a des notes, classe qui a des inscriptions, affectations ou évaluations, matière ou évaluation encore référencée. La base, elle, cascade certaines lignes ; l'API refuse avant.

## 4. Pagination et filtres

Les listes paginées répondent `{ "data", "page", "pageSize", "total" }`. `page` commence à 1, `pageSize` vaut 25 par défaut et 100 au plus.

`q` cherche le nom, le prénom et le matricule, après trim, en insensible à la casse. `%`, `_` et `'` sont des littéraux.

## 5. Routes métier

Sauf mention, le corps des écritures est du JSON et la session est obligatoire.

### Élèves

| Méthode | Route | Écriture |
| --- | --- | --- |
| GET | `/api/eleves?q&classeId&statut&page&pageSize&sort&order` | — |
| POST | `/api/eleves` | ADMIN |
| GET, PATCH, DELETE | `/api/eleves/:id` | ADMIN pour PATCH et DELETE |

```json
{
  "matricule": "MAT-TEST-100",
  "nom": "Diallo",
  "prenom": "Awa",
  "dateNaissance": "2014-03-12",
  "sexe": "F",
  "classeId": "00000000-0000-4000-8000-000000000001"
}
```

Le matricule est trimé puis mis en capitales. La création inscrit l'élève dans la classe. `DELETE` d'un élève noté : `409`. `PATCH` peut changer `classeId` (déplacement dans l'année de la classe). Le matricule n'est pas modifiable. `version` (horodatage ISO renvoyé par l'API) provoque un `409` si la fiche a changé.

### Classes et inscriptions

| Méthode | Route | Écriture |
| --- | --- | --- |
| GET | `/api/classes?anneeScolaireId` | — |
| POST, PATCH, DELETE | `/api/classes` et `/api/classes/:id` | ADMIN |
| POST | `/api/classes/:id/inscriptions` | ADMIN |
| DELETE | `/api/classes/:id/inscriptions/:eleveId` | ADMIN |

```json
{ "nom": "3e Z", "niveauId": "…", "anneeScolaireId": "…", "professeurPrincipalId": null }
```

```json
{ "eleveId": "…", "statut": "INSCRIT" }
```

### Matières, enseignants, affectations

| Méthode | Route | Écriture |
| --- | --- | --- |
| GET, POST | `/api/matieres` | POST ADMIN |
| PATCH, DELETE | `/api/matieres/:id` | ADMIN |
| GET, POST | `/api/enseignants` | POST ADMIN |
| PATCH, DELETE | `/api/enseignants/:id` | ADMIN |
| GET, POST | `/api/affectations?classeId&enseignantId` | POST ADMIN |
| DELETE | `/api/affectations/:id` | ADMIN |

```json
{ "code": "LAT", "nom": "Latin", "coefficient": 2, "niveauId": null }
```

```json
{ "enseignantId": "…", "classeId": "…", "matiereId": "…" }
```

L'année de l'affectation est celle de la classe. Une classe n'a qu'un enseignant par matière : le doublon est un `409`.

### Années, périodes, niveaux, établissement

| Méthode | Route | Écriture |
| --- | --- | --- |
| GET, POST | `/api/annees` | POST ADMIN, DIRECTION |
| PATCH | `/api/annees/:id` | ADMIN, DIRECTION (`statut` : `PREPARATION`, `EN_COURS`, `CLOTUREE`) |
| GET, POST | `/api/periodes?anneeScolaireId` | POST ADMIN, DIRECTION |
| PATCH, DELETE | `/api/periodes/:id` | ADMIN, DIRECTION |
| GET | `/api/niveaux` | tout compte authentifié |
| GET, PATCH | `/api/etablissement` | PATCH ADMIN, GET ADMIN et DIRECTION |

Une seule année `EN_COURS`. Ouvrir une deuxième sans clôturer la précédente : `409`.

### Comptes

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET, POST | `/api/utilisateurs` | ADMIN |
| PATCH | `/api/utilisateurs/:id` | ADMIN |

Le mot de passe initial fait au moins 12 caractères. Le changement exige `motDePasseActuel`. La réponse ne contient jamais `motDePasseHash`.

`PATCH /api/profil/mot-de-passe` et `PATCH /api/utilisateurs/:id` lorsqu'il contient `motDePasse` partagent le limiteur de tentatives (compte de session et IP, défaut 5 essais / 15 minutes, `PASSWORD_RATE_LIMIT_*`). `POST /api/utilisateurs/:id/mot-de-passe-temporaire` a son propre plafond (`TEMP_PASSWORD_RATE_LIMIT_*`, défaut 30 émissions par administrateur, 60 par IP, fenêtre 900 secondes). Les clés sont distinctes : réinitialiser des comptes ne consomme pas les 5 essais de changement, et le plafond temporaire reste borné. Le dépassement est le `429` décrit plus haut. Le corps ne dit pas si le compte existe. Sous le seuil, les messages restent ceux d'avant : `403` « Le mot de passe actuel est requis. », `404` « Utilisateur introuvable. » pour un identifiant inconnu, `200` `{ "ok": true }` ou `{ "motDePasseTemporaire" }`. Une réussite de changement par l'utilisateur ou par `PATCH` remet le compteur du compte à zéro. Chaque émission de mot de passe temporaire compte, y compris une réussite, sans remise à zéro.

```json
{
  "email": "lea.dubois@tilleuls.demo",
  "motDePasse": "Un-mot-de-passe-12",
  "roleCode": "ENSEIGNANT",
  "enseignantId": "…",
  "prenom": "Léa",
  "nom": "Dubois"
}
```

### Évaluations

| Méthode | Route | Écriture |
| --- | --- | --- |
| GET | `/api/evaluations?classeId&matiereId&periodeId` | selon la matrice de lecture |
| POST | `/api/evaluations` | ADMIN, ou enseignant affecté |
| GET, PATCH, DELETE | `/api/evaluations/:id` | même périmètre d'écriture ; DELETE `409` s'il reste des notes |

```json
{
  "classeId": "…",
  "matiereId": "…",
  "periodeId": "…",
  "type": "DEVOIR",
  "libelle": "Contrôle API",
  "date": "2025-10-06",
  "noteMax": 20,
  "coefficient": 1
}
```

`type` : `DEVOIR`, `COMPOSITION`, `INTERROGATION`. L'enseignant enregistré est celui de l'affectation. Un enseignant ne peut pas désigner un collègue.

### Notes

| Méthode | Route | Effet |
| --- | --- | --- |
| GET | `/api/notes?evaluationId&eleveId&classeId&matiereId` | lecture selon le périmètre |
| POST | `/api/notes` | création. Doublon élève+évaluation : `409` |
| POST | `/api/notes/lot` | création ou mise à jour, une transaction |
| POST | `/api/notes/valider` | mêmes contrôles, aucune écriture de note. Limite par utilisateur de session et par IP (`VALIDATION_RATE_LIMIT_*`, défaut 30 et 120 par minute) : le `429` décrit plus haut. L'audit `NOTE_VALIDATION` n'est écrit qu'au premier passage d'un état ; un appel identique ne rajoute pas de ligne. L'enregistrement depuis l'écran de saisie appelle cette route avant d'écrire, pour afficher le même message |
| GET, PATCH, DELETE | `/api/notes/:id` | `version` optionnelle, `409` si elle ne correspond plus |

```json
{ "evaluationId": "…", "eleveId": "…", "valeur": 15, "estAbsent": false, "commentaire": null }
```

Absence : `{ "valeur": null, "estAbsent": true }`. `0` est une note. Plus de deux décimales, valeur négative, valeur au-dessus de `noteMax`, ou élève non `INSCRIT` dans la classe : `422`.

Lot :

```json
{
  "evaluationId": "…",
  "lignes": [
    { "eleveId": "…", "valeur": 15, "estAbsent": false },
    { "eleveId": "…", "valeur": null, "estAbsent": true }
  ]
}
```

Une ligne peut porter son propre `evaluationId`. Si l'une sort du périmètre, tout le lot est un `403`. Soixante écritures de notes par minute et par session ; le lot compte pour une requête. Trente recherches `q` par minute.

### Bulletins et analyses

Calculés à la lecture, sur les notes PostgreSQL, uniquement par `src/lib/grading` : `computePeriodReport` (moyennes de matières puis moyenne générale), `appreciate`, `rankCompetition`, `computeStatistics` et `compareTerms`. Aucune formule n'est recodée dans les routes.

| Méthode | Route | Contenu |
| --- | --- | --- |
| GET | `/api/bulletins?eleveId&periodeId` | lignes de matières, moyenne générale, appréciation, rang, effectif. Sans `periodeId` : l'année de l'inscription |
| GET | `/api/analyses/eleve?eleveId&periodeId` | même document |
| GET | `/api/analyses/classe?classeId&periodeId&matiereId` | élèves, moyennes, statistiques de classe |
| GET | `/api/analyses/matiere?classeId&matiereId&periodeId` | moyennes de la matière, absences, part sous 10 |
| GET | `/api/analyses/temporelle?eleveId` ou `classeId` | un point par trimestre |
| GET | `/api/analyses/etablissement?anneeScolaireId&periodeId` | moyennes par classe et de l'établissement |

Un enseignant reçoit les matières de ses affectations, sans moyenne générale ni rang calculés sur les autres matières. Le professeur principal de la classe reçoit le bulletin complet. Le rang est `rankCompetition` : les moyennes publiées au même centième sont ex æquo et le rang suivant est sauté (1, 1, 3 si l'égalité est en tête ; 1, 2, 2, 4 si elle est en deuxième place).

Statistiques : `computeStatistics` sur les moyennes déjà publiées. La réponse expose l'effectif, le nombre de moyennes calculables, la moyenne de classe, le minimum, le maximum, la médiane, le taux de réussite (≥ 10) et la distribution des six mentions du module. L'analyse temporelle ajoute `comparaison`, le résultat de `compareTerms` (écarts, tendance, plus haut et plus bas trimestre). L'analyse matière ajoute le rang dans la matière.

### Audit et santé

| Méthode | Route | Accès |
| --- | --- | --- |
| GET | `/api/audit` | ADMIN. Créations, modifications, suppressions et validations de notes, connexions, déconnexions, refus `403`. Horodatage UTC. Pas de mot de passe |
| GET | `/api/health` | public, `{ "status": "ok" }`, aucune donnée métier |

Le journal n'est pas modifiable par l'API. Conservation visée : 12 mois, les lignes restent en base au redéploiement. Il n'y a pas de route de réinitialisation de mot de passe.

## 6. En-têtes

Posés par `src/middleware.ts` et sur chaque réponse JSON :

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` avec `frame-ancestors 'none'` et `script-src 'self'` (pas de `unsafe-eval`). `style-src 'unsafe-inline'` couvre le CSS injecté par Next.js.
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cache-Control: private, no-store`
- `Strict-Transport-Security: max-age=15552000; includeSubDomains` en production
- `X-Powered-By` retiré (`poweredByHeader: false`)

Aucune origine CORS n'est reflétée : l'API est same-origin. Une écriture dont l'`Origin` n'est ni `APP_URL` ni l'hôte de la requête est refusée.

## 7. Variables

| Nom | Usage |
| --- | --- |
| `DATABASE_URL` | PostgreSQL. Local en développement, Neon (marketplace Vercel) en production, avec TLS hors machine locale |
| `AUTH_SECRET` | Chiffrement de session. Absent du dépôt, 32 caractères minimum. Le remplacer dans Vercel puis redéployer invalide les sessions dont le secret ne déchiffre plus le cookie ; incrémenter `session_version` les révoque immédiatement |
| `APP_URL` | Origine canonique |

`.env.example` ne contient que des valeurs fictives. `.env` n'est pas versionné.

## 8. Écarts assumés avec le plan de tests

Le plan QA et la checklist ont été rédigés avant le modèle figé. Là où ils divergent, l'analyse et le schéma priment :

- Rôles réels : `ADMIN`, `DIRECTION`, `ENSEIGNANT`, `PROFESSEUR_PRINCIPAL`, `CONSULTATION`. Pas de rôle élève ni de scolarité. La direction lit les notes et ne les modifie pas. Seul l'administrateur inscrit les élèves.
- Le classement est celui de `rankCompetition` (rang de compétition). L'exemple 1, 1, 3 de l'analyse et l'exemple 1, 2, 2, 4 du module décrivent la même règle : l'ex æquo partage le rang, le suivant est sauté.
- Les notes sont ramenées sur 20 avant la moyenne de matière, comme le module de calcul.
- Pas d'historique de valeurs autre que le journal d'audit (ancienne et nouvelle valeur). Pas de table d'audit modifiable.
- Le seed de démo partage un hash bcrypt de coût 10. Les mots de passe créés ensuite sont au coût 12, sels distincts.

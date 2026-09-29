# Checklist de sécurité — Plateforme de saisie, gestion et analyse des notes

| | |
|---|---|
| Document | Checklist de sécurité |
| Statut | Référentiel de validation |
| Public | Sécurité, développement, QA |
| Pile cible | Next.js, TypeScript, Tailwind CSS, PostgreSQL, hébergement Vercel |
| Hors périmètre de ce document | Code applicatif, schéma, architecture, `package.json` |

Chaque contrôle se valide par une observation binaire : **passé** ou **échoué**. Une intention (« nous utilisons Zod », « les mots de passe sont hashés ») n'est pas une preuve. La preuve est le résultat décrit dans la colonne « Critère de validation ».

Document complémentaire : [plan de tests](../qa/plan-de-tests.md). Les identifiants QA (`AUTHZ-02`, `DB-NOT-03`, etc.) désignent les cas déjà spécifiés dans ce plan.

## 1. Règles de lecture

| Sévérité | Conséquence si le contrôle échoue |
|---|---|
| Bloquant | Pas de mise à disposition des données élèves. Correction avant toute preview partagée hors équipe. |
| Majeur | Correction avant ouverture aux enseignants. Une preview interne reste possible sur données fictives. |
| Mineur | Correction planifiée. La mise à disposition n'est pas retenue par ce seul point. |

Acteurs de référence, identiques au plan de tests :

| Compte de test | Rôle | Périmètre |
|---|---|---|
| `admin@etab.test` | administrateur | établissement |
| `scolarite@etab.test` | scolarite | référentiel, lecture des notes, pas d'écriture de note |
| `ens.math@etab.test` | enseignant | 3e A · Mathématiques · année courante |
| `ens.fr@etab.test` | enseignant | 3e A · Français · année courante |
| `eleve.e01@etab.test` | eleve | ses notes uniquement |

Règle métier bloquante, rappelée ici parce qu'elle concentre le risque d'accès illégitime aux notes :

> Un enseignant ne crée, ne modifie ni ne supprime une note, ni l'évaluation qui la porte, pour une classe ou une matière qui ne lui est pas affectée.

Les secrets cités dans ce document sont des noms de variables, jamais des valeurs.

## 2. Synthèse des contrôles

| ID | Thème | Sévérité |
|---|---|---|
| SEC-AUTH-01 à 08 | Authentification | Bloquant |
| SEC-AUTHZ-01 à 06 | Autorisation par rôle | Bloquant |
| SEC-ENS-01 à 06 | Périmètre d'affectation enseignant | Bloquant |
| SEC-VAL-01 à 06 | Validation Zod | Bloquant |
| SEC-API-01 à 07 | Protection des endpoints | Bloquant |
| SEC-SQL-01 à 04 | Injection SQL | Bloquant |
| SEC-PWD-01 à 05 | Hachage des mots de passe | Bloquant |
| SEC-SESS-01 à 07 | Cookies et sessions | Bloquant |
| SEC-ENV-01 à 06 | Secrets et variables d'environnement | Bloquant |
| SEC-DATA-01 à 07 | Données sensibles | Majeur, SEC-DATA-01 et 04 bloquants |
| SEC-RATE-01 à 04 | Rate limiting | Majeur |
| SEC-HDR-01 à 06 | En-têtes de sécurité | Majeur, SEC-HDR-01 bloquant en production |
| SEC-LOG-01 à 06 | Journalisation | Majeur |
| SEC-NOTES-01 à 08 | Contrôle d'accès aux notes | Bloquant |

## 3. Authentification

### SEC-AUTH-01 — Secret de session distinct des mots de passe

| | |
|---|---|
| Exigence | L'authentification repose sur un secret de session connu du seul serveur. |
| Critère de validation | `AUTH_SECRET` (ou le nom retenu par l'architecture) est présent dans l'environnement d'exécution, absent du dépôt, et fait au moins 32 octets aléatoires. Un redémarrage avec cette variable vide refuse de servir les routes authentifiées (échec au démarrage ou `500` contrôlé sans émettre de cookie). |
| Preuve | Capture de la configuration d'environnement **sans** la valeur, plus journal de démarrage en l'absence de variable. |

### SEC-AUTH-02 — Identifiants valides

| | |
|---|---|
| Exigence | Un compte actif avec le bon mot de passe obtient une session. |
| Critère de validation | `POST` de connexion de `admin@etab.test` avec le mot de passe du seed de test renvoie un succès et un cookie. L'appel suivant à une route privée renvoie `200`. Cas QA : AUTH-01. |
| Preuve | Trace HTTP (statuts et noms d'en-têtes uniquement, cookie masqué). |

### SEC-AUTH-03 — Échec indistinguable

| | |
|---|---|
| Exigence | Un attaquant ne découvre pas quels identifiants existent. |
| Critère de validation | Mot de passe faux (AUTH-02) et identifiant inconnu (AUTH-03) produisent le même statut `401`, le même corps JSON (message générique « Identifiants invalides ») et un temps de réponse du même ordre (écart inférieur à 200 ms sur 20 essais, pour limiter un oracle de timing trivial). Aucun cookie de session. |
| Preuve | Deux échanges HTTP juxtaposés et la série des 20 durées. |

### SEC-AUTH-04 — Compte inactif

| | |
|---|---|
| Exigence | Un compte désactivé n'ouvre pas de session, même avec le bon mot de passe. |
| Critère de validation | AUTH-04 renvoie `403` sans cookie. Les routes privées avec un ancien cookie de ce compte, émis avant la désactivation, renvoient `401`. |
| Preuve | Trois statuts HTTP : connexion refusée, ancien cookie refusé, compte témoin actif toujours accepté. |

### SEC-AUTH-05 — Déconnexion

| | |
|---|---|
| Exigence | La déconnexion invalide la session côté serveur. |
| Critère de validation | Après déconnexion, le cookie capturé avant l'action reçoit `401` sur une route privée (AUTH-06). Effacer le cookie seulement dans le navigateur, sans invalidation serveur, est un échec. |
| Preuve | Rejeu du cookie (valeur masquée dans le rapport). |

### SEC-AUTH-06 — Expiration

| | |
|---|---|
| Exigence | Une session a une durée de vie bornée. |
| Critère de validation | La durée maximale est définie (référence : 8 heures d'inactivité ou 12 heures absolues, la valeur d'architecture prévaut si elle est écrite). Une session dont l'expiration est dans le passé reçoit `401` (AUTH-05). Aucune route de notes n'accepte un cookie expiré. |
| Preuve | Horodatage d'émission, horodatage d'expiration, statut `401`. |

### SEC-AUTH-07 — Rotation à la connexion

| | |
|---|---|
| Exigence | Une nouvelle connexion ne réutilise pas l'identifiant de session précédent. |
| Critère de validation | Deux connexions successives du même compte produisent deux identifiants de session différents. L'ancien est refusé (AUTH-07). |
| Preuve | Comparaison des identifiants après hachage ou troncature (ne pas coller les valeurs brutes dans le ticket). |

### SEC-AUTH-08 — Transport de l'authentification

| | |
|---|---|
| Exigence | Le mot de passe ne voyage pas dans l'URL, ni dans un journal, ni dans le stockage du navigateur hors cookie de session. |
| Critère de validation | La connexion est un `POST` HTTPS. Les journaux de l'essai ne contiennent pas le mot de passe. `sessionStorage` et `localStorage` ne contiennent ni mot de passe ni copie du jeton. Le corps de réponse de connexion ne renvoie pas le mot de passe ni son hachage. |
| Preuve | Extrait de logs filtré, dump des storages (vide de secret), corps de réponse. |

## 4. Autorisation par rôle

L'autorisation est évaluée sur le serveur à chaque requête. Un menu masqué dans l'interface, sans contrôle serveur, est un échec.

### SEC-AUTHZ-01 — Refus par défaut

| | |
|---|---|
| Exigence | Une route métier sans session est refusée. |
| Critère de validation | Chaque route de la matrice SEC-API-01, appelée sans cookie, renvoie `401`. Le corps ne contient ni élève, ni note, ni message d'erreur SQL. |
| Preuve | Tableau route → statut, produit par la campagne QA. |

### SEC-AUTHZ-02 — Séparation des rôles

| | |
|---|---|
| Exigence | Chaque rôle n'atteint que les actions de son profil. |
| Critère de validation | La matrice suivante est verte en entier. |

| Action | administrateur | scolarite | enseignant | eleve |
|---|---|---|---|---|
| Créer un élève | 201 | 201 | 403 | 403 |
| Supprimer une classe vide | 204 | 403 | 403 | 403 |
| Créer une matière | 201 | 403 | 403 | 403 |
| Créer une affectation | 201 | 201 | 403 | 403 |
| Lire les statistiques de classe | 200 | 200 | 200 sur son périmètre, 403 sinon | 403 |
| Modifier une note de son périmètre | 200 | 403 | 200 si affecté, 403 sinon | 403 |
| Lire la note d'un autre élève | 200 | 200 | 200 si affecté à la classe et la matière, 403 sinon | 403 |

| | |
|---|---|
| Preuve | Jeu QA AUTHZ-01 à AUTHZ-15, statuts observés. |

### SEC-AUTHZ-03 — Pas d'élévation par le corps de requête

| | |
|---|---|
| Exigence | Un client ne choisit pas son rôle dans le JSON. |
| Critère de validation | `PATCH` du profil de `eleve.e01` avec `{ "role": "administrateur" }` renvoie `422` (objet strict, VAL-08) ou ignore le champ sans changer le rôle. La session suivante de cet élève reçoit encore `403` sur la création d'élève. |
| Preuve | Ligne utilisateur en base : rôle inchangé. Appel d'écriture suivant : `403`. |

### SEC-AUTHZ-04 — Pas d'élévation par l'identifiant

| | |
|---|---|
| Exigence | Remplacer un identifiant dans l'URL ne donne pas les droits du propriétaire. |
| Critère de validation | `eleve.e01` appelle `GET` et `PATCH` sur la note de Boris : `403` ou `404`, note de Boris inchangée, corps sans la valeur (AUTHZ-10, AUTHZ-11). |
| Preuve | Valeur de la note de Boris avant et après, statut HTTP. |

### SEC-AUTHZ-05 — Rôle lu côté serveur

| | |
|---|---|
| Exigence | Le rôle effectif vient de la session serveur, pas d'un en-tête ou d'un claim modifiable par le client. |
| Critère de validation | Ajouter `x-role: administrateur` ou un cookie forgé `role=administrateur` sur la session de `eleve.e01` laisse les écritures en `403`. |
| Preuve | Requête brute et statut. |

### SEC-AUTHZ-06 — Cohérence UI / API

| | |
|---|---|
| Exigence | Masquer un bouton ne constitue pas le contrôle. |
| Critère de validation | Pour chaque action interdite dans l'interface enseignant (créer une classe, saisir le français sans affectation), l'appel direct à l'endpoint renvoie `403` même si la page a été altérée pour afficher le bouton. |
| Preuve | Capture d'écran de l'absence du bouton **et** trace `403` de l'appel direct. Les deux sont requis. |

## 5. Périmètre d'affectation enseignant

Contrôle clé. `ens.math` est affecté à 3e A · Mathématiques uniquement. `ens.fr` est affecté à 3e A · Français uniquement. Les évaluations et les notes de test existent dans les deux matières.

### SEC-ENS-01 — Modification hors matière

| | |
|---|---|
| Exigence | Un enseignant ne modifie pas la note d'une matière non affectée. |
| Critère de validation | `ens.math` envoie `PATCH` sur la note de français d'Amina. Statut `403`. Relecture par `administrateur` : valeur identique à celle d'avant l'appel. Cas AUTHZ-02. |
| Preuve | Valeur avant, requête, statut, valeur après. |

### SEC-ENS-02 — Modification hors classe

| | |
|---|---|
| Exigence | Un enseignant ne modifie pas la note d'une classe non affectée, y compris dans sa matière. |
| Critère de validation | `ens.math` envoie `POST` d'une note de Mathématiques pour un élève de la 3e B. Statut `403`. Aucune ligne insérée. Cas AUTHZ-03. |
| Preuve | Comptage des notes de l'évaluation 3e B avant et après : identique. |

### SEC-ENS-03 — Création et suppression d'évaluation

| | |
|---|---|
| Exigence | Le même périmètre s'applique à l'évaluation porteuse, pas seulement à la note. |
| Critère de validation | `ens.math` : `POST` d'une évaluation de français → `403` ; `DELETE` d'une évaluation de français → `403` ; `POST` d'une évaluation de maths de la 3e A → `201`. Cas API-EVL-02, AUTHZ-04, API-EVL-01. |
| Preuve | Trois statuts et liste des évaluations inchangée côté français. |

### SEC-ENS-04 — Affectation retirée

| | |
|---|---|
| Exigence | Le droit suit l'affectation courante, pas l'historique. |
| Critère de validation | Après suppression de l'affectation maths de `ens.math` par `administrateur`, le même `PATCH` qu'en SEC-ENS-01 sur une note de maths renvoie `403` (AUTHZ-15). Les notes déjà saisies restent en base. |
| Preuve | Statut `403` horodaté après l'heure de suppression de l'affectation. |

### SEC-ENS-05 — Auto-affectation impossible

| | |
|---|---|
| Exigence | Un enseignant ne s'attribue pas une classe ou une matière. |
| Critère de validation | `ens.math` envoie `POST` d'une affectation vers le français ou vers la 3e B. Statut `403`. La table des affectations est inchangée (AUTHZ-14). |
| Preuve | Comptage SQL des affectations de cet enseignant : toujours 1. |

### SEC-ENS-06 — Lecture hors périmètre

| | |
|---|---|
| Exigence | La lecture des notes suit le même périmètre que l'écriture pour un enseignant. |
| Critère de validation | `ens.fr` lit le français de la 3e A : `200`. `ens.fr` lit les maths de la 3e A : `403` et corps sans valeur de note (AUTHZ-05, AUTHZ-06). |
| Preuve | Les deux corps de réponse, notes masquées dans le rapport de preuve hors environnement de test. |

Le contournement par identifiant deviné, par lot (`ids: [...]` mélangeant maths et français) ou par changement de `classeId` dans le corps suit la même règle : si une cible du lot sort du périmètre, la référence de sécurité est le rejet du lot entier en `403` et zéro écriture.

## 6. Validation des entrées (Zod)

### SEC-VAL-01 — Schéma sur chaque écriture

| | |
|---|---|
| Exigence | Tout corps de requête d'écriture est parsé par un schéma Zod avant d'atteindre la base. |
| Critère de validation | Une revue de la liste des routes `POST`, `PATCH` et `PUT` montre un schéma Zod par route. Un corps `{}` sur la création d'élève renvoie `422` avec les champs manquants et n'insère rien (VAL-01). |
| Preuve | Liste route → schéma, plus trace VAL-01. |

### SEC-VAL-02 — Types et bornes

| | |
|---|---|
| Exigence | Les types, longueurs et domaines numériques sont refusés hors contrat. |
| Critère de validation | Les cas VAL-03 à VAL-14 passent : matricule trop court ou trop long, nom vide, coefficient chaîne ou nul ou négatif, `noteMax` négatif, date impossible, e-mail invalide, mot de passe de moins de 12 caractères. Chaque cas : `422` et aucune ligne nouvelle. |
| Preuve | Tableau QA VAL-03…VAL-14. |

### SEC-VAL-03 — Objet strict

| | |
|---|---|
| Exigence | Les propriétés non déclarées ne sont pas recopiées en base. |
| Critère de validation | Création d'élève avec un champ `role` ou `estAdministrateur` : `422` (VAL-08). Aucune colonne de privilège n'est alimentée par ce corps. |
| Preuve | Réponse `422` et ligne absente, ou ligne présente sans privilège si l'architecture documente l'ignorance des champs. La référence de cette checklist est le rejet strict. |

### SEC-VAL-04 — Note dans le barème

| | |
|---|---|
| Exigence | Zod refuse une note négative, une note au-dessus de `noteMax`, et une absence qui porterait une valeur. |
| Critère de validation | API-NOT-09 (`-0.01`) → `422`. API-NOT-10 (`20.01` sur 20) → `422`. API-NOT-14 (valeur et statut absent) → `422`. API-NOT-11 et API-NOT-12 (0 et `noteMax`) → `201`. |
| Preuve | Cinq statuts. Ce contrôle ne remplace pas les `CHECK` SQL (SEC-SQL-04). |

### SEC-VAL-05 — Identifiants

| | |
|---|---|
| Exigence | Les identifiants de chemin et de corps sont des UUID valides, ou le format réellement retenu, vérifié avant la requête SQL. |
| Critère de validation | `classeId: "pas-un-uuid"` → `422` (VAL-07). Identifiant bien formé et inconnu → `404`. Jamais `500` avec une pile ou un message d'analyseur SQL. |
| Preuve | Deux réponses, corps sans stack trace. |

### SEC-VAL-06 — Recherche bornée

| | |
|---|---|
| Exigence | Le paramètre de recherche est une chaîne bornée, pas une expression libre. |
| Critère de validation | `q` de 81 caractères → `422` (VAL-16). `q` contenant `%`, `_` ou `'` est traité comme du littéral : aucun élargissement du résultat au-delà des correspondances textuelles. |
| Preuve | Cas FE-RCH-05 et un jeu où un nom contient un pourcent encodé : une seule ligne, celle de ce nom. |

## 7. Protection des endpoints

### SEC-API-01 — Inventaire authentifié

| | |
|---|---|
| Exigence | Toute route qui lit ou écrit des données d'établissement exige une session, sauf la connexion et les assets publics. |
| Critère de validation | Inventaire des routes applicatives (App Router). Pour chacune, la colonne « anonyme » vaut `401` ou fait partie de l'exception documentée : `POST /connexion`, `GET` des pages publiques de présentation, fichiers statiques. Une route de notes absente de l'inventaire est un échec. |
| Preuve | Tableau d'inventaire signé dans le rapport de campagne. |

Référence d'inventaire minimale :

| Route (ressource) | Anonyme | Session élève | Session enseignant |
|---|---|---|---|
| Connexion | 200 / 401 selon le corps | — | — |
| Élèves | 401 | 403 en écriture, lecture de soi si la route existe | 403 en écriture |
| Classes, matières | 401 | 403 | 403 en écriture |
| Affectations | 401 | 403 | 403 en écriture |
| Évaluations | 401 | 403 en écriture | selon SEC-ENS |
| Notes | 401 | lecture de soi, écriture 403 | selon SEC-ENS |
| Statistiques de classe | 401 | 403 | selon périmètre |
| Santé technique `/health` | 200 sans donnée métier | — | — |

### SEC-API-02 — Méthodes

| | |
|---|---|
| Exigence | Une route de lecture n'accepte pas une écriture déguisée. |
| Critère de validation | `PUT`, `PATCH` ou `DELETE` sur une URL de collection non prévue renvoie `405`. `GET` d'une URL d'écriture de note ne modifie pas la base (comptage identique avant et après). |
| Preuve | Statuts et comptages. |

### SEC-API-03 — Erreurs sans fuite interne

| | |
|---|---|
| Exigence | Les réponses d'erreur n'exposent pas de pile, de requête SQL, de nom d'hôte de base, ni de valeur de variable d'environnement. |
| Critère de validation | Provoquer VAL-15 (JSON invalide), un UUID inconnu et un conflit d'unicité. Les trois corps contiennent un message fonctionnel. Aucun ne contient `SELECT`, `password`, `postgres://`, `node_modules` ou une stack `at `. |
| Preuve | Trois corps de réponse archivés. |

### SEC-API-04 — CSRF sur cookie de session

| | |
|---|---|
| Exigence | Une requête d'écriture authentifiée par cookie ne peut pas être forgée depuis une autre origine. |
| Critère de validation | `POST` de note depuis une origine `https://evil.example` (en-tête `Origin` hostile), avec le cookie de `ens.math`, est refusé (`403`). Le même `POST` depuis l'origine de l'application est accepté si le droit métier est vert. Le cookie de session a `SameSite=Lax` ou `Strict` (SEC-SESS-02). |
| Preuve | Deux requêtes, deux statuts, note créée seulement pour l'origine légitime. |

### SEC-API-05 — CORS

| | |
|---|---|
| Exigence | L'API n'est pas lisible par une origine arbitraire avec les cookies. |
| Critère de validation | `Access-Control-Allow-Origin` n'est pas `*` sur une route authentifiée. L'origine de preview ou de production attendue est la seule reflétée. `Access-Control-Allow-Credentials: true` n'accompagne pas une origine `*`. |
| Preuve | En-têtes de réponse d'une route de notes. |

### SEC-API-06 — Téléchargement et export

| | |
|---|---|
| Exigence | Un export de notes obéit aux mêmes droits que l'écran. |
| Critère de validation | L'export CSV ou PDF de la 3e A · Mathématiques par `ens.fr` renvoie `403` et un fichier vide ou absent. L'export par `ens.math` contient uniquement cette classe et cette matière. |
| Preuve | Statut et en-tête du fichier (ou absence de fichier). |

### SEC-API-07 — Identifiants séquentiels devinables

| | |
|---|---|
| Exigence | Parcourir des identifiants ne révèle pas les notes d'autrui. |
| Critère de validation | Si les identifiants sont des entiers séquentiels, SEC-AUTHZ-04 et SEC-NOTES-02 restent verts. Si les identifiants sont des UUID v4, un UUID voisin aléatoire renvoie `404` sans oracle d'existence différent entre « interdit » et « absent » pour le rôle `eleve` (même statut dans les deux cas). |
| Preuve | Deux appels élève, mêmes statut et forme de corps. |

## 8. Injection SQL

### SEC-SQL-01 — Requêtes paramétrées

| | |
|---|---|
| Exigence | Aucune concaténation de valeur utilisateur dans une chaîne SQL. |
| Critère de validation | Revue des accès PostgreSQL : paramètres liés (`$1`, requêtes préparées du client retenu). Une occurrence de concaténation d'une entrée HTTP dans le SQL est un échec, y compris dans un tri (`ORDER BY ${colonne}`) si la colonne n'est pas prise dans une liste blanche. |
| Preuve | Note de revue indiquant les fichiers lus et le résultat. Cette checklist ne modifie pas ces fichiers. |

### SEC-SQL-02 — Charge utile classique

| | |
|---|---|
| Exigence | Une charge d'injection ne change pas le résultat ni le schéma. |
| Critère de validation | Recherche `q=' OR 1=1 --` : `200` avec zéro ligne ou `422`, jamais la liste des élèves (FE-RCH-05). Création d'élève dont le nom est `Test'); DROP TABLE eleves; --` : soit `422`, soit `201` avec ce nom stocké comme littéral. La table des élèves existe encore ensuite et le nombre de lignes est celui attendu (0 ou 1 nouvelle). |
| Preuve | Comptage de lignes avant et après, statut HTTP. |

### SEC-SQL-03 — Tri et filtre

| | |
|---|---|
| Exigence | Le nom de colonne de tri est une liste blanche. |
| Critère de validation | `sort=nom` trie par le nom. `sort=nom;drop table eleves` renvoie `422` ou ignore le tri. La table existe encore. |
| Preuve | Statut et `SELECT count(*)` réussi après coup. |

### SEC-SQL-04 — Contraintes en dernière ligne

| | |
|---|---|
| Exigence | La base refuse les invariants même si l'API est contournée. |
| Critère de validation | Les insertions SQL directes DB-ELV-01, DB-NOT-01, DB-NOT-03 et DB-NOT-04 échouent (`23505` ou `23514`). Une note négative et une note supérieure à `noteMax` n'ont aucune ligne. |
| Preuve | Codes d'erreur PostgreSQL du rapport QA, section 7.12. |

## 9. Hachage des mots de passe

### SEC-PWD-01 — Algorithme

| | |
|---|---|
| Exigence | Les mots de passe sont hachés avec un algorithme de mot de passe adapté, sel unique par compte. |
| Critère de validation | La colonne de secret commence par `$argon2id$` (Argon2id) ou `$2a$` / `$2b$` (bcrypt). Référence : Argon2id. Bcrypt est acceptable avec un coût ≥ 12. MD5, SHA-1, SHA-256 seul, ou un secret sans sel : échec. Deux comptes avec le même mot de passe de test ont deux hachages différents. |
| Preuve | Préfixes des hachages (pas les hachages complets) de deux comptes de test. |

### SEC-PWD-02 — Absence de clair

| | |
|---|---|
| Exigence | Le mot de passe en clair n'est pas stocké, ni dans une colonne parallèle, ni dans un journal, ni dans un événement d'audit. |
| Critère de validation | Recherche du mot de passe de test dans un export de la base de test et dans les journaux de la tentative de connexion : zéro occurrence. La réponse de `GET` utilisateur ne contient pas le hachage. |
| Preuve | Résultat de recherche (compte d'occurrences = 0) et corps `GET` utilisateur. |

### SEC-PWD-03 — Vérification

| | |
|---|---|
| Exigence | La vérification utilise la fonction de l'algorithme, pas une comparaison du clair. |
| Critère de validation | Le bon mot de passe ouvre une session (SEC-AUTH-02). Un mot de passe qui est le hachage lui-même est refusé (`401`). Un mot de passe qui diffère d'un caractère est refusé. |
| Preuve | Trois statuts de connexion. |

### SEC-PWD-04 — Politique minimale

| | |
|---|---|
| Exigence | Les mots de passe trop courts sont refusés à la création et au changement. |
| Critère de validation | VAL-14 : `court1` → `422`. Un mot de passe de 12 caractères conforme est accepté. Le changement de mot de passe exige le mot de passe courant ; sans lui, `401` ou `403`, et le hachage en base reste celui d'avant. |
| Preuve | Statuts et préfixe de hachage inchangé après la tentative sans mot de passe courant. |

### SEC-PWD-05 — Réinitialisation

| | |
|---|---|
| Exigence | Un jeton de réinitialisation est à usage unique, aléatoire, à durée courte, et n'est pas le mot de passe. |
| Critère de validation | Si la fonction existe : le jeton stocké est haché, expire (référence : 1 heure), et un second usage renvoie `400`. Le lien ne place pas le jeton dans un journal applicatif. Si la fonction n'existe pas encore : le contrôle est « non applicable » et aucune route morte ne doit accepter un `POST` de réinitialisation ouvert. |
| Preuve | Deux usages du jeton, ou inventaire montrant l'absence de route. |

## 10. Cookies et sessions

### SEC-SESS-01 — Attributs du cookie

| | |
|---|---|
| Exigence | Le cookie de session est inexploitable par un script de page et n'est pas envoyé en clair. |
| Critère de validation | Le cookie émis à la connexion porte `HttpOnly`, `Secure`, `Path=/`, et `SameSite=Lax` ou `SameSite=Strict`. `Secure` est présent sur toute preview et en production. En local HTTP, l'exception est documentée et ne s'applique pas aux déploiements Vercel. |
| Preuve | En-tête `Set-Cookie` avec la valeur du cookie masquée. |

### SEC-SESS-02 — SameSite et CSRF

| | |
|---|---|
| Exigence | `SameSite` limite l'envoi inter-sites. |
| Critère de validation | La valeur observée est `Lax` ou `Strict`. Combiné à SEC-API-04 : l'écriture inter-origine est refusée. `SameSite=None` est un échec. |
| Preuve | Attribut observé. |

### SEC-SESS-03 — Durée

| | |
|---|---|
| Exigence | Le cookie et la session serveur expirent. |
| Critère de validation | `Max-Age` ou `Expires` est présent et cohérent avec SEC-AUTH-06. Un cookie dont la session serveur est révoquée ne suffit pas : le serveur répond `401`. |
| Preuve | En-tête et rejeu après révocation. |

### SEC-SESS-04 — Fixation de session

| | |
|---|---|
| Exigence | Le serveur émet l'identifiant de session. Il n'accepte pas un identifiant fourni par le client avant l'authentification. |
| Critère de validation | Envoyer un cookie `session=valeur-choisie-par-le-client` pendant le `POST` de connexion n'aboutit pas à une session portant cette valeur. L'identifiant émis après succès est nouveau (SEC-AUTH-07). |
| Preuve | Comparaison : valeur injectée ≠ valeur émise. |

### SEC-SESS-05 — Déconnexion complète

| | |
|---|---|
| Exigence | La déconnexion efface le cookie et révoque l'enregistrement serveur. |
| Critère de validation | La réponse de déconnexion contient `Set-Cookie` qui vide le cookie (`Max-Age=0` ou date passée) avec les mêmes `HttpOnly`, `Secure`, `Path`. Le rejeu (SEC-AUTH-05 / AUTH-06) renvoie `401`. |
| Preuve | En-tête de déconnexion et statut du rejeu. |

### SEC-SESS-06 — Pas de session dans l'URL

| | |
|---|---|
| Exigence | L'identifiant de session n'apparaît pas dans les URL, les redirections ou le champ `Referer` vers un tiers. |
| Critère de validation | Aucune réponse `3xx` ne place le jeton dans `Location`. Les pages authentifiées ne construisent pas de lien externe avec le cookie. `Referrer-Policy` est défini (SEC-HDR-04). |
| Preuve | Revue des redirections de connexion. |

### SEC-SESS-07 — Stockage serveur

| | |
|---|---|
| Exigence | Le serveur peut révoquer une session. Un cookie autosuffisant et non révocable est insuffisant pour les notes. |
| Critère de validation | Désactiver le compte ou appeler la déconnexion rend le cookie immédiatement inutilisable, sans attendre son expiration calendaire. Une liste de révocation ou une session en base démontrable satisfait le critère. |
| Preuve | Horodatage de révocation antérieur à l'expiration, statut `401`. |

## 11. Secrets et variables d'environnement

### SEC-ENV-01 — Aucun secret dans le dépôt

| | |
|---|---|
| Exigence | Les secrets ne sont pas écrits dans le code, les fixtures versionnées, les workflows ou les fichiers d'exemple. |
| Critère de validation | Recherche dans le dépôt (hors historique de secrets déjà purgés, qui serait un incident séparé) : aucune occurrence de `postgres://` avec un mot de passe réel, aucune clé `sk_`, aucune valeur de `AUTH_SECRET`. `.env`, `.env.local`, `.env.production` sont ignorés par Git. `.env.example` ne contient que des noms et des valeurs fictives du type `change-me`. |
| Preuve | Résultat de recherche et contenu de `.env.example` s'il existe. |

### SEC-ENV-02 — Noms attendus

| | |
|---|---|
| Exigence | La configuration d'exécution porte au minimum les variables nécessaires, hors du code. |
| Critère de validation | Les noms suivants, ou leurs équivalents documentés par l'architecture, sont définis dans l'environnement Vercel du déploiement concerné et absents des sources : |

| Nom | Usage |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `AUTH_SECRET` | Signature ou chiffrement de session |
| `APP_URL` | Origine canonique (CORS, cookies) |

| | |
|---|---|
| Preuve | Liste des **noms** configurés sur l'environnement Vercel, pas des valeurs. |

### SEC-ENV-03 — Séparation des environnements

| | |
|---|---|
| Exigence | La preview ne pointe pas vers la base de production. |
| Critère de validation | L'hôte de `DATABASE_URL` de preview est différent de celui de production. Une campagne QA sur preview ne lit aucun matricule réel. Les variables de production ne sont pas exposées aux pull requests de forks. |
| Preuve | Hôtes (sans identifiants) des deux environnements. |

### SEC-ENV-04 — Exposition client

| | |
|---|---|
| Exigence | Un secret n'est pas préfixé pour le bundle navigateur. |
| Critère de validation | Aucune variable `NEXT_PUBLIC_` ne contient un secret, une URL de base avec mot de passe, ni `AUTH_SECRET`. Le bundle client de preview, recherché pour `AUTH_SECRET` et `DATABASE_URL`, ne contient pas leurs valeurs. |
| Preuve | Liste des `NEXT_PUBLIC_*` et résultat de recherche dans les assets publiés. |

### SEC-ENV-05 — Journaux de build

| | |
|---|---|
| Exigence | Les journaux de build Vercel ne révèlent pas les secrets. |
| Critère de validation | Un extrait de journal de build et de fonction ne contient pas la chaîne de connexion complète ni `AUTH_SECRET`. Une commande de debug qui imprime `process.env` est un échec. |
| Preuve | Extrait de log revue. |

### SEC-ENV-06 — Rotation

| | |
|---|---|
| Exigence | Un secret peut être remplacé sans modification de code. |
| Critère de validation | Procédure écrite : mettre à jour la variable dans Vercel, redéployer, invalider les sessions. Aucune valeur de secret dans un ticket ou dans ce dossier `docs/`. |
| Preuve | La procédure figure dans le runbook d'exploitation (lien), ou le présent contrôle reste ouvert tant que le runbook n'existe pas. |

## 12. Données sensibles

Les notes, le matricule, la date de naissance et l'identifiant de connexion identifient un élève, souvent mineur. La minimisation et le contrôle d'accès priment sur l'export large.

### SEC-DATA-01 — Chiffrement en transit

| | |
|---|---|
| Sévérité | Bloquant en preview publique et en production |
| Exigence | Les échanges navigateur–application et application–PostgreSQL sont chiffrés. |
| Critère de validation | L'URL servie est `https`. Une requête `http` est redirigée vers `https`. `DATABASE_URL` utilise `sslmode=require` (ou plus strict) hors base locale de développement. |
| Preuve | URL finale et paramètre d'hôte (sans secret). |

### SEC-DATA-02 — Minimisation des réponses

| | |
|---|---|
| Exigence | Une réponse ne renvoie que les champs nécessaires à l'écran. |
| Critère de validation | `GET` élève par un enseignant affecté ne contient pas le hachage de mot de passe, ni un secret de session, ni les notes des matières non affectées. `GET` de la fiche par l'élève lui-même ne contient pas la liste des camarades. |
| Preuve | Corps JSON annoté (données de test uniquement). |

### SEC-DATA-03 — Export et cache

| | |
|---|---|
| Exigence | Les pages de notes ne sont pas mises en cache partagé. |
| Critère de validation | Les réponses de notes portent `Cache-Control: private, no-store` (ou équivalent qui interdit un cache partagé). Un second utilisateur sur le même navigateur après déconnexion ne voit pas les notes du précédent (jeu manuel : connexion Amina, déconnexion, connexion Boris, aucune note d'Amina). |
| Preuve | En-tête et résultat du jeu manuel. |

### SEC-DATA-04 — Cloisonnement des environnements

| | |
|---|---|
| Sévérité | Bloquant |
| Exigence | Les données réelles d'élèves n'alimentent pas les postes de développement ni les jeux de test versionnés. |
| Critère de validation | Le seed du dépôt ne contient que des personnes fictives (`Amina Kane`, `E01`…). Aucun fichier du dépôt n'est un export scolaire réel. |
| Preuve | Revue du seed. |

### SEC-DATA-05 — Sauvegarde

| | |
|---|---|
| Exigence | Les sauvegardes de production sont chiffrées et accessibles au seul rôle d'exploitation. |
| Critère de validation | La documentation d'hébergement PostgreSQL indique le chiffrement au repos et la liste des personnes habilitées. Un compte enseignant ne peut pas lancer un dump. |
| Preuve | Lien vers le réglage d'hébergement et test d'accès enseignant refusé. |

### SEC-DATA-06 — Rétention

| | |
|---|---|
| Exigence | Une année archivée n'est plus modifiable par un enseignant. |
| Critère de validation | Sur une année marquée close, `ens.math` reçoit `403` sur `PATCH` de note. `administrateur` peut encore lire. Toute autre règle d'archivage doit être écrite avant la première année réelle ; tant qu'elle est absente, ce contrôle reste ouvert. |
| Preuve | Statut `403` sur année close. |

### SEC-DATA-07 — Postes partagés

| | |
|---|---|
| Exigence | La fin de session est explicite pour un ordinateur de salle des professeurs. |
| Critère de validation | Le bouton de déconnexion est présent sur l'écran de saisie. SEC-SESS-05 est vert. L'expiration d'inactivité (SEC-AUTH-06) est active. |
| Preuve | Capture de l'écran de saisie montrant la déconnexion, plus SEC-SESS-05. |

## 13. Rate limiting

### SEC-RATE-01 — Connexion

| | |
|---|---|
| Exigence | Les essais de mot de passe sont bornés. |
| Critère de validation | Référence : 5 échecs en 15 minutes pour le couple (adresse IP, identifiant), puis `429` jusqu'à la fin de la fenêtre. Le 6e essai, même avec le bon mot de passe, est `429`. Un autre identifiant depuis la même IP n'est pas bloqué par ce seul compte (évite le déni de service trivial sur `admin`). Les succès ne renvoient pas la liste des comptes. |
| Preuve | Six statuts datés et un succès sur un second compte. |

### SEC-RATE-02 — Réponse homogène

| | |
|---|---|
| Exigence | Le rate limit ne crée pas un oracle plus bavard que SEC-AUTH-03. |
| Critère de validation | Le corps du `429` est générique. Il ne dit pas si l'identifiant existe. `Retry-After` est présent. |
| Preuve | Corps et en-tête. |

### SEC-RATE-03 — Écriture de notes

| | |
|---|---|
| Exigence | Un client authentifié ne peut pas inonder l'API de notes. |
| Critère de validation | Référence : au plus 60 requêtes d'écriture de notes par minute et par session. La 61e renvoie `429`. Une session enseignant légitime qui enregistre une grille de 30 élèves en une requête reste acceptée (le lot compte pour une requête). |
| Preuve | Statut de la requête de grille `200` ou `201`, puis statut `429` au-delà du seuil, sur un compte de test. |

### SEC-RATE-04 — Recherche

| | |
|---|---|
| Exigence | La recherche n'est pas un canal d'énumération illimité. |
| Critère de validation | Référence : 30 recherches par minute et par session. Au-delà, `429`. Le rôle `eleve` ne dispose pas d'une recherche globale d'établissement (déjà couvert par SEC-DATA-02) ; s'il l'a, c'est un échec même sous le seuil. |
| Preuve | Statut `429` et absence de recherche globale côté élève. |

Le contrôle fumigène suffit pour cette checklist. Une campagne de charge ne fait pas partie du critère de passage.

## 14. En-têtes de sécurité

Mesure : réponse HTTPS d'une page authentifiée et d'une route de notes.

### SEC-HDR-01 — HTTPS et HSTS

| | |
|---|---|
| Sévérité | Bloquant en production |
| Exigence | Le navigateur ne repasse pas en clair. |
| Critère de validation | Redirection HTTP → HTTPS. En production, `Strict-Transport-Security` contient `max-age` ≥ `15552000` (180 jours). La preview peut utiliser une valeur plus courte, mais l'en-tête est présent. |
| Preuve | En-têtes de production ou de preview, selon l'environnement évalué. |

### SEC-HDR-02 — Type de contenu

| | |
|---|---|
| Exigence | Le navigateur ne réinterprète pas les réponses. |
| Critère de validation | `X-Content-Type-Options: nosniff` est présent sur les documents et sur les réponses JSON de l'API. |
| Preuve | En-tête observé. |

### SEC-HDR-03 — Cadres

| | |
|---|---|
| Exigence | L'application n'est pas embarquée dans une iframe tierce. |
| Critère de validation | `Content-Security-Policy` contient `frame-ancestors 'none'` ou `X-Frame-Options: DENY`. |
| Preuve | En-tête observé. |

### SEC-HDR-04 — Référent et permissions

| | |
|---|---|
| Exigence | Le référent envoyé aux tiers est réduit. Les API du navigateur non utilisées sont fermées. |
| Critère de validation | `Referrer-Policy: strict-origin-when-cross-origin` (ou plus strict). `Permissions-Policy` désactive au minimum `camera=()`, `microphone=()`, `geolocation=()`. |
| Preuve | Deux en-têtes. |

### SEC-HDR-05 — Content-Security-Policy

| | |
|---|---|
| Exigence | Une CSP limite les sources de script. |
| Critère de validation | `Content-Security-Policy` est présente. Elle ne contient pas `script-src *` ni `unsafe-eval`. Si `unsafe-inline` est présent, la raison est écrite (contrainte du framework) et un nonce ou un hash est le objectif de remplacement. Les scripts de l'application proviennent de l'origine de l'app. |
| Preuve | En-tête CSP complet. |

### SEC-HDR-06 — Pas d'information de version inutile

| | |
|---|---|
| Exigence | Les en-têtes ne détaillent pas la pile au-delà du nécessaire. |
| Critère de validation | Pas d'en-tête `X-Powered-By: Next.js` (ou il est retiré). Le corps d'erreur reste conforme à SEC-API-03. |
| Preuve | Liste d'en-têtes de réponse. |

## 15. Journalisation

### SEC-LOG-01 — Événements d'authentification

| | |
|---|---|
| Exigence | Les succès, échecs et déconnexions sont journalisés. |
| Critère de validation | Après AUTH-01, AUTH-02 et une déconnexion, trois événements existent avec : horodatage, type d'événement, identifiant du compte (ou identifiant présenté s'il est inconnu, tronqué), résultat, adresse IP. Le mot de passe est absent (SEC-PWD-02). |
| Preuve | Trois lignes de journal, secrets masqués. |

### SEC-LOG-02 — Audit des notes

| | |
|---|---|
| Exigence | Chaque création, modification et suppression de note est auditée. |
| Critère de validation | Après API-NOT-06 (15 → 14), un enregistrement d'audit contient : acteur (`ens.math`), élève, évaluation, ancienne valeur `15`, nouvelle valeur `14`, horodatage. Une suppression consigne l'ancienne valeur et l'acteur. L'audit n'est pas modifiable par `enseignant` ni par `eleve` (`403` sur toute route d'édition d'audit). |
| Preuve | Ligne d'audit et statut `403` d'une tentative de modification. |

### SEC-LOG-03 — Refus d'autorisation

| | |
|---|---|
| Exigence | Les refus `403` sur les notes sont journalisés. |
| Critère de validation | SEC-ENS-01 produit un événement : acteur, cible, action `PATCH`, résultat `403`. Cet événement permet de retrouver la tentative hors affectation. |
| Preuve | Ligne de journal correspondant à l'heure de la requête. |

### SEC-LOG-04 — Contenu exclu

| | |
|---|---|
| Exigence | Les journaux ne sont pas une copie intégrale des bulletins ni un dépôt de secrets. |
| Critère de validation | Un export de logs d'une campagne de saisie de 30 notes ne contient pas `DATABASE_URL`, `AUTH_SECRET`, ni le mot de passe. Il peut contenir les valeurs de notes dans le flux d'audit (SEC-LOG-02), pas dans les logs de debug de requêtes SQL complètes avec paramètres sensibles. `console.log` du corps de connexion est un échec. |
| Preuve | Recherche de ces motifs dans l'échantillon de logs : 0 secret. |

### SEC-LOG-05 — Accès aux journaux

| | |
|---|---|
| Exigence | Seul un administrateur ou l'exploitation consulte l'audit. |
| Critère de validation | `ens.math` et `eleve.e01` reçoivent `403` sur la consultation de l'audit. `administrateur` reçoit `200` limité aux événements, sans secret. |
| Preuve | Trois statuts. |

### SEC-LOG-06 — Horodatage et conservation

| | |
|---|---|
| Exigence | Les événements sont datés en UTC et conservés au-delà de la session. |
| Critère de validation | L'horodatage est en UTC. La durée de conservation est écrite (référence : 12 mois pour l'audit de notes). Un redéploiement ne vide pas l'audit déjà écrit en base. |
| Preuve | Deux événements dont l'un antérieur au dernier déploiement, toujours lisibles. |

## 16. Contrôle d'accès aux notes

Cette section rassemble les scénarios qui touchent directement une note, y compris ceux déjà numérotés plus haut, afin qu'une revue sécurité puisse les signer d'un bloc.

### SEC-NOTES-01 — Écriture selon l'affectation

| | |
|---|---|
| Exigence | Créer, modifier, supprimer une note exige l'affectation classe **et** matière, ou le rôle administrateur. |
| Critère de validation | SEC-ENS-01, SEC-ENS-02, SEC-ENS-03 et AUTHZ-12 sont verts dans la même campagne. `scolarite` reste en `403` (AUTHZ-08). |
| Preuve | Renvoi aux traces de ces contrôles. |

### SEC-NOTES-02 — Lecture selon le sujet

| | |
|---|---|
| Exigence | Un élève ne lit que ses notes. Un enseignant ne lit que son périmètre. |
| Critère de validation | AUTHZ-09, AUTHZ-10, AUTHZ-06 verts. Le corps interdit ne contient pas `valeur`. |
| Preuve | Corps de réponse de test. |

### SEC-NOTES-03 — Lot mixte

| | |
|---|---|
| Exigence | Un enregistrement groupé ne sert pas à glisser une note hors périmètre. |
| Critère de validation | `ens.math` envoie un lot de 2 lignes : une note de maths 3e A valide, une note de français 3e A. Réponse `403`. Comptage des notes : aucune des deux lignes n'est écrite. |
| Preuve | Comptage avant = comptage après. |

### SEC-NOTES-04 — Changement d'identifiants dans le corps

| | |
|---|---|
| Exigence | Le serveur recalcule le périmètre à partir des identifiants persistés, pas d'un libellé envoyé par le client. |
| Critère de validation | `PATCH` d'une note de maths avec un corps qui ajoute `matiereId` du français ou `classeId` de la 3e B : la note de maths est modifiée seulement si l'enseignant y est affecté, et aucune note de français n'est créée. Un `eleveId` qui ne correspond pas à l'évaluation renvoie `422` (API-NOT-15). |
| Preuve | État des deux matières après l'appel. |

### SEC-NOTES-05 — Note d'un élève hors classe de l'évaluation

| | |
|---|---|
| Exigence | L'intégrité pédagogique est aussi un contrôle d'accès. |
| Critère de validation | API-NOT-15 : élève de 3e B sur évaluation de 3e A → `422`, zéro ligne. |
| Preuve | Trace QA. |

### SEC-NOTES-06 — Statistiques et classements

| | |
|---|---|
| Exigence | Les agrégats ne contournent pas le cloisonnement. |
| Critère de validation | `eleve.e01` sur les statistiques de classe : `403` (E2E-11). `ens.math` sur les statistiques de français : `403` ou agrégat vide sans notes individuelles. Un classement renvoyé à l'élève ne contient que son rang et sa moyenne, ou, si la politique d'établissement affiche le classement de classe, cette politique est écrite et exclut les notes détaillées des camarades. Référence tant que la politique n'est pas écrite : l'élève ne reçoit pas les moyennes nominatives des autres. |
| Preuve | Corps JSON du rôle élève. |

### SEC-NOTES-07 — Identifiant direct

| | |
|---|---|
| Exigence | Connaître l'UUID d'une note ne suffit pas. |
| Critère de validation | `GET`, `PATCH` et `DELETE` sur l'UUID d'une note de français, cookie de `ens.math` : tous `403`. La note existe encore, valeur inchangée. |
| Preuve | Trois statuts et relecture administrateur. |

### SEC-NOTES-08 — Après retrait d'affectation

| | |
|---|---|
| Exigence | Le droit n'est pas mis en cache au-delà de la requête. |
| Critère de validation | SEC-ENS-04 : le premier `PATCH` après le retrait est déjà `403`, sans nouvelle connexion obligatoire si la session charge l'affectation à chaque requête. Si l'architecture met l'affectation en session, la révocation de l'affectation invalide les sessions de cet enseignant ; le critère se vérifie alors par `401` puis, après reconnexion, `403`. |
| Preuve | Statut du premier appel post-retrait. |

## 17. Ordre d'exécution recommandé

1. SEC-ENV-01 à 04 (aucun secret dans le dépôt, environnements séparés) avant la première preview.
2. SEC-PWD et SEC-SESS avant tout compte réel.
3. SEC-AUTH, SEC-AUTHZ, SEC-ENS, SEC-NOTES sur le seed de test.
4. SEC-VAL et SEC-SQL, y compris les insertions SQL directes.
5. SEC-API, SEC-HDR, SEC-RATE, SEC-LOG, SEC-DATA.

Une campagne est acceptée lorsque tous les contrôles bloquants sont passés et que chaque contrôle majeur échoué possède un écart écrit, daté et assumé.

## 18. Points d'attention

1. **La règle enseignant est un contrôle serveur.** Le masquage des écrans (SEC-AUTHZ-06) ne la remplace pas. SEC-ENS-01 à SEC-ENS-06 sont la preuve.
2. **Zod et SQL sont complémentaires.** SEC-VAL-04 peut passer alors que SEC-SQL-04 échoue si les `CHECK` ne sont pas en base. Les deux sont bloquants.
3. **Même message d'échec de connexion.** SEC-AUTH-03 tombe dès que le texte ou le statut distingue un compte inexistant d'un mauvais mot de passe.
4. **Preview Vercel.** SEC-ENV-03 tombe si la preview consomme `DATABASE_URL` de production. Les données élèves réelles n'ont pas leur place sur une branche de pull request.
5. **Cookie `Secure`.** Il est obligatoire dès que l'application est servie en HTTPS. L'exception locale doit rester locale.
6. **Audit des notes.** Une modification 15 → 14 sans ancienne valeur (SEC-LOG-02) empêche de reconstituer une contestation. Le journal ne doit pas pour autant contenir les secrets (SEC-LOG-04).
7. **Lot de saisie.** Le rejet entier du lot hors périmètre (SEC-NOTES-03) évite qu'une ligne interdite soit écrite parmi des lignes valides. Aligner ce choix avec FE-SAI-03 du plan de tests.
8. **Classement visible par les élèves.** SEC-NOTES-06 retient la minimisation tant qu'une décision d'établissement n'est pas écrite.
9. **Ce document ne contient pas de code.** Toute correction se fait dans le dépôt applicatif, sur les routes, les schémas Zod, les contraintes PostgreSQL et la configuration Vercel.
10. **Pas de valeur secrète dans les preuves.** Les rapports de campagne masquent cookies, hachages complets et URL de connexion. Les matricules cités ici sont fictifs.

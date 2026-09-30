# Plan de tests — Plateforme de saisie, gestion et analyse des notes

| | |
|---|---|
| Document | Plan de tests QA |
| Statut | Référentiel d'acceptation |
| Public | QA, développement, sécurité |
| Pile cible | Next.js, TypeScript, Tailwind CSS, PostgreSQL, Vercel |
| Hors périmètre de ce document | Code applicatif, schéma de base, architecture, `package.json` |

Ce plan fixe la stratégie de test et les résultats attendus. Il ne contient aucun code applicatif. Les identifiants de cas (`UT-MOY-01`, `E2E-09`, etc.) restent stables même si les noms de tables ou de routes évoluent dans les livrables d'architecture.

Document complémentaire : [checklist de sécurité](../security/checklist-securite.md).

## 1. Objet

Vérifier que la plateforme permet de saisir, gérer et analyser les notes d'un établissement scolaire, et que les calculs, les droits et les contraintes de données produisent des résultats déterministes.

Objectifs de la campagne :

1. Prouver les calculs de moyennes et de classements sur des jeux chiffrés.
2. Prouver le CRUD des entités métier et le rejet des données invalides.
3. Prouver l'authentification et l'autorisation par rôle, en particulier la règle enseignant.
4. Prouver les contraintes de persistance au niveau API et au niveau base.
5. Prouver un parcours métier complet, de l'année scolaire jusqu'aux statistiques.

## 2. Périmètre

### 2.1 Inclus

| Domaine | Contenu |
|---|---|
| Référentiel | Année scolaire, classe, élève, matière, enseignant, affectation |
| Évaluation | Évaluation rattachée à une classe et une matière, coefficient, barème |
| Notes | Saisie, modification, absence, consultation |
| Analyse | Moyenne de matière, moyenne générale, classement, statistiques de classe |
| Accès | Authentification, rôles, périmètre d'affectation |
| Interface | Formulaires, tableaux, recherche, filtres, grille de saisie |

### 2.2 Exclus

- L'analyseur JSON statique déjà présent à la racine du dépôt (`index.html`) : il ne fait pas partie de la plateforme de notes.
- La paie, l'emploi du temps, la messagerie et les applications mobiles natives.
- Un test de charge complet. Le rate limiting est couvert par la checklist de sécurité, avec un contrôle fumigène uniquement.

### 2.3 Rôles du référentiel

| Rôle | Lecture | Écriture |
|---|---|---|
| `administrateur` | Tout l'établissement | Tout le référentiel, les évaluations et les notes |
| `scolarite` | Tout l'établissement | Élèves, classes, matières, années, affectations. Pas de modification de note |
| `enseignant` | Classes et matières qui lui sont affectées | Évaluations et notes de ses affectations uniquement |
| `eleve` | Ses propres notes, moyennes et rang | Aucune |

Un compte de test ne cumule pas deux rôles. La règle bloquante est la suivante : **un enseignant ne crée, ne modifie ni ne supprime une note (ni l'évaluation porteuse) d'une classe ou d'une matière qui ne lui est pas affectée.**

## 3. Règles d'acceptation figées pour les tests

Ces règles sont le contrat QA. Si l'architecture en retient d'autres, les sorties attendues de ce plan sont mises à jour avant l'exécution, sans changer les identifiants de cas.

### 3.1 Notes

- Barème par défaut : 20. Chaque évaluation porte son `noteMax` (> 0).
- Une note présente est un nombre à au plus 2 décimales, avec `0 ≤ valeur ≤ noteMax`.
- `0` est une note réelle. Elle entre dans les calculs.
- Une note absente a une valeur nulle et le statut `absent`. Elle est acceptée en base.
- Une valeur négative ou supérieure à `noteMax` est refusée, que l'appel passe par l'API ou par une insertion directe.
- Un élève n'a qu'une seule note par évaluation.

### 3.2 Moyennes

Pour les notes **présentes** d'un même périmètre :

```text
moyenne = Σ (valeur × coefficient) / Σ (coefficient)
```

- Le coefficient d'une évaluation est un nombre > 0.
- Une note absente est exclue du numérateur et son coefficient est exclu du dénominateur.
- Si aucune note présente n'existe, la moyenne est non calculable : valeur nulle, libellé affiché `NC`. Elle n'est pas remplacée par 0.
- Affichage et classement : arrondi half-up à 2 décimales (le chiffre suivant ≥ 5 arrondit à l'éloigné de zéro). Exemple : `10,666…` → `10,67` ; `9,333…` → `9,33`.
- La comparaison de classement utilise la valeur déjà arrondie à 2 décimales.
- La moyenne générale d'un élève pondère les moyennes de matières calculables par le coefficient de matière :

```text
moyenne générale = Σ (moyenne matière × coefficient matière) / Σ (coefficients des matières calculables)
```

Cas de référence obligatoire :

```text
(15 × 4 + 12 × 2) / (4 + 2) = 84 / 6 = 14,00
```

### 3.3 Classement

- Tri des moyennes décroissant.
- Ex æquo : même moyenne arrondie → même rang. Le rang suivant est sauté (méthode 1, 2, 2, 4).
- À moyenne égale, l'ordre d'affichage est le nom puis le prénom, sans changer le rang.
- Un élève `NC` n'a pas de rang numérique. Il apparaît après les élèves classés et ne décale pas les rangs des autres.

### 3.4 Intégrité référentielle

- Le matricule élève est unique dans l'établissement.
- La paire (élève, évaluation) est unique.
- La suppression d'un enregistrement qui possède des dépendances métier (classe avec élèves, évaluation avec notes, matière avec évaluations) est refusée. Aucune note n'est supprimée en cascade.
- L'année scolaire, la classe, la matière et l'évaluation d'une note restent cohérentes : un élève ne reçoit une note que pour une évaluation de sa classe.

### 3.5 Jeux de données de référence

Les mots de passe de test n'existent que dans l'environnement de test. Ils ne sont pas des secrets de production.

| Compte | Rôle | Périmètre |
|---|---|---|
| `admin@etab.test` | administrateur | établissement |
| `scolarite@etab.test` | scolarite | établissement |
| `ens.math@etab.test` | enseignant | 3e A · Mathématiques · année courante |
| `ens.fr@etab.test` | enseignant | 3e A · Français · année courante |
| `eleve.e01@etab.test` | eleve | élève E01 uniquement |

**Classe témoin** (preuves de calcul) : 3e A, année `2025-2026`.

| Élève | Maths coef. 4 | Maths coef. 2 | Français coef. 1 (`noteMax` 20) | Moyenne maths | Moyenne générale (maths coef. 4, français coef. 2) |
|---|---|---|---|---|---|
| Amina Kane | 15 | 12 | 16 | **14,00** | (14×4 + 16×2) / 6 = **14,67** |
| Boris Ndiaye | 14 | 14 | 10 | **14,00** | (14×4 + 10×2) / 6 = **12,67** |
| Chloé Bernard | 18 | absente | 12 | **18,00** | (18×4 + 12×2) / 6 = **16,00** |
| David Costa | absente | absente | absente | **NC** | **NC** |
| Émile Faye | 20 | 0 | 11 | (80 + 0) / 6 = **13,33** | (13,33×4 + 11×2) / 6 = **12,55** |

Détail Amina, mathématiques : `(15×4 + 12×2) / (4+2) = 14,00`.

Détail Émile, moyenne générale : la moyenne de maths arrondie `13,33` est l'entrée du second calcul, conformément à la règle d'arrondi avant usage aval. `13,33×4 + 11×2 = 75,32` ; `75,32 / 6 = 12,5533…` → `12,55`.

Classement de mathématiques (classe témoin) :

| Rang | Élève | Moyenne |
|---|---|---|
| 1 | Chloé Bernard | 18,00 |
| 2 | Amina Kane | 14,00 |
| 2 | Boris Ndiaye | 14,00 |
| 4 | Émile Faye | 13,33 |
| NC | David Costa | NC |

**Classe volume** (30 élèves, scénarios E2E) : 3e B, matricules `MAT-2025-001` à `MAT-2025-030`, élèves E01 à E30, ordre d'affichage par matricule.

| Élève | Note maths (éval. coef. 2) | Note français (éval. coef. 1) | Moyenne générale (maths coef. matière 4, français coef. matière 2) |
|---|---|---|---|
| E01 | 15 | 12 | (15×4 + 12×2) / 6 = **14,00** |
| E02 | absente | 12 | **12,00** (seul le français est calculable) |
| E03 à E29 | 10 | 12 | (10×4 + 12×2) / 6 = 64/6 → **10,67** |
| E30 | 10 | 8 | (10×4 + 8×2) / 6 = 56/6 → **9,33** |

Classement général 3e B :

| Rang | Élèves | Moyenne |
|---|---|---|
| 1 | E01 | 14,00 |
| 2 | E02 | 12,00 |
| 3 | E03 à E29 (27 ex æquo) | 10,67 |
| 30 | E30 | 9,33 |

Statistiques de moyenne générale, 3e B, 30 élèves tous calculables :

| Indicateur | Valeur attendue |
|---|---|
| Effectif | 30 |
| Nombre de moyennes calculables | 30 |
| Somme exacte | 14 + 12 + 27×(64/6) + 56/6 = 970/3 |
| Moyenne de classe | (970/3) / 30 = 97/9 = **10,78** |
| Médiane | moyenne des 15e et 16e valeurs triées = **10,67** |
| Minimum | **9,33** (E30) |
| Maximum | **14,00** (E01) |
| Taux de moyennes ≥ 10,00 | 29/30 = **96,67 %** |
| Tranche [0 ; 10[ | 1 |
| Tranche [10 ; 12[ | 27 |
| Tranche [12 ; 14[ | 1 |
| Tranche [14 ; 16[ | 1 |
| Tranche [16 ; 20] | 0 |
| Absences de note (toutes évaluations) | 1 (E02 en maths) |

Tri croissant utilisé pour la médiane : `9,33`, puis `10,67` (positions 2 à 28), puis `12,00` (position 29), puis `14,00` (position 30).

## 4. Stratégie

Les cinq niveaux s'empilent. Un calcul juste en unitaire qui échoue dans le parcours navigateur reste un échec de campagne.

```text
E2E (Playwright, parcours métier)
        ↑
Frontend (Testing Library : formulaires, tableaux, saisie)
        ↑
API (handlers Next.js, auth, validation, codes HTTP)
        ↑
Base (contraintes PostgreSQL sur un schéma de test)
        ↑
Unitaires (fonctions pures de moyenne, rang, arrondi, statistiques)
```

| Niveau | But | Données | Isolation |
|---|---|---|---|
| Unitaires calculs | Formules, arrondis, ex æquo, absences, divisions par zéro | Jeux en mémoire, sans I/O | Aucune base, aucune session |
| API | Contrats HTTP, codes, corps, droits, Zod | Base de test transactionnelle, annulée après chaque cas | Cookie de session du rôle sous test |
| Base | Contraintes SQL indépendantes de l'API | SQL direct sur une base jetable | Sans passer par les handlers |
| Frontend | Composants et états d'écran | API simulée ou environnement de test | Un écran par fichier de test |
| E2E | Les 11 scénarios métier enchaînables | Jeu `2025-2026` rechargé au début de la suite | Navigateur réel |

Règle de preuve : chaque cas ci-dessous indique les **entrées** et la **sortie attendue**. Un cas est passé seulement si toutes les sorties listées sont observées. Une sortie partielle est un échec.

Priorité :

- **P0** bloque la livraison (calculs de référence, unicité, droits enseignant, authentification).
- **P1** doit passer avant une ouverture aux utilisateurs (CRUD complet, formulaires, recherche, statistiques).
- **P2** consolide l'usage (tris secondaires, messages exacts, pagination).

## 5. Outils suggérés

| Besoin | Outil | Usage dans cette campagne |
|---|---|---|
| Tests unitaires et d'intégration TS | **Vitest** | Calculs, schémas Zod, handlers |
| Couverture | Vitest coverage (v8) | Seuil visé : 100 % des branches des fonctions de moyenne, rang et statistiques |
| Composants React | **Testing Library** + **jsdom** | Formulaires, tableaux, messages, état vide |
| Bout en bout | **Playwright** | Les 11 scénarios, Chromium en CI, Firefox en nuité |
| Contrats HTTP | `next/test` ou appel direct des handlers via Vitest | Codes 200, 201, 400, 401, 403, 404, 409, 422, 429 |
| Base | **PostgreSQL** éphémère (service CI ou Testcontainers) | Contraintes `UNIQUE` et `CHECK` |
| Données | SQL de seed versionné + fabriques de test | Jeux « classe témoin » et « classe volume » |
| Lint / types | ESLint, `tsc --noEmit` | Préalable à la campagne, pas un substitut aux cas métier |
| Sécurité applicative | Voir la checklist | ZAP en base line, revue des en-têtes, jeux d'injection |
| Accessibilité de la grille | `@axe-core/playwright` sur l'écran de saisie | Un passage, pas une certification |

Les outils sont des suggestions de campagne. Leur ajout au dépôt relève de l'équipe applicative : ce plan ne modifie pas `package.json`.

Commandes cibles, une fois l'outillage choisi par l'équipe applicative :

```bash
npx vitest run
npx vitest run --coverage
npx playwright test
```

## 6. Environnements et données

| Environnement | Base | Comptes | Usage |
|---|---|---|---|
| Local | PostgreSQL dédié `notes_test` | Jeu de seed | Développement des tests |
| CI (pull request) | Instance éphémère | Seed rejoué à chaque job | Unitaires, API, base, Playwright |
| Preview Vercel | Base de preview, jamais la base de production | Comptes de démo | Fumigène manuel avant promotion |
| Production | Données réelles | Comptes réels | Aucun cas de ce plan |

Chaque test API ou base s'exécute dans une transaction annulée, ou sur un schéma recréé. Les tests E2E partent d'un seed identique et ne dépendent pas de l'ordre d'une autre suite.

Critères d'entrée de campagne :

1. Le schéma migré expose les entités de la section 2.
2. Le seed « classe témoin » et les cinq comptes existent.
3. Les fonctions de calcul sont pures et appelables sans serveur.
4. Un compte enseignant de seed possède une affectation et une seule.

Critères de sortie :

1. 100 % des cas P0 passent.
2. 100 % des cas P1 passent, ou chaque échec possède un défaut tracé et accepté par écrit.
3. Les 11 scénarios E2E passent sur un même jeu, dans l'ordre E2E-01 → E2E-11.
4. Aucun cas de la checklist de sécurité marqué bloquant n'est en échec.

## 7. Catalogue des cas

Colonnes communes : identifiant, priorité, entrées, sortie attendue. Les préconditions s'ajoutent quand le cas n'est pas autonome.

### 7.1 CRUD élèves

Précondition commune : administrateur authentifié, année `2025-2026`, classe 3e A existante.

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| API-ELV-01 | P0 | `POST` élève `{ matricule: "MAT-2025-100", nom: "Diallo", prenom: "Awa", classeId }` | `201`. Corps : id, matricule, nom, prénom, classe. Relecture `GET` identique. |
| API-ELV-02 | P0 | `POST` avec le matricule déjà créé | `409`. Aucun second enregistrement. Message indiquant l'unicité du matricule. |
| API-ELV-03 | P1 | `GET /eleves/:id` de l'élève créé | `200` et les champs persistés. |
| API-ELV-04 | P1 | `GET /eleves?classeId=` de la 3e A | `200`. Liste contenant l'élève, sans élève d'une autre classe. |
| API-ELV-05 | P1 | `PATCH` `{ nom: "Diallo", prenom: "Awa Marie" }` | `200`. Le matricule et la classe restent inchangés. |
| API-ELV-06 | P1 | `PATCH` `{ classeId }` vers la 3e B | `200`. Les notes déjà saisies dans la 3e A restent rattachées à leurs évaluations d'origine ; l'élève n'apparaît plus dans la grille de saisie 3e A. |
| API-ELV-07 | P1 | `DELETE` élève sans note | `204`. `GET` suivant : `404`. |
| API-ELV-08 | P0 | `DELETE` élève qui possède une note | `409`. La note et l'élève existent encore. |
| API-ELV-09 | P1 | `GET /eleves/00000000-0000-0000-0000-000000000000` | `404`. |
| API-ELV-10 | P2 | `POST` sans authentification | `401`. Aucune écriture. |

### 7.2 CRUD classes

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| API-CLS-01 | P0 | `POST` `{ nom: "3e A", niveau: "3e", anneeScolaireId }` | `201`. Couple (nom, année) persisté. |
| API-CLS-02 | P0 | Second `POST` du même nom sur la même année | `409`. |
| API-CLS-03 | P1 | Même nom sur l'année `2026-2027` | `201`. Les deux classes coexistent. |
| API-CLS-04 | P1 | `GET` liste filtrée par année | Uniquement les classes de cette année. |
| API-CLS-05 | P1 | `PATCH` `{ nom: "3e A1" }` | `200`. Les élèves rattachés restent rattachés. |
| API-CLS-06 | P0 | `DELETE` classe contenant au moins un élève | `409`. Élèves et notes intacts. |
| API-CLS-07 | P1 | `DELETE` classe vide, sans affectation ni évaluation | `204`. |
| API-CLS-08 | P1 | `POST` `{ nom: "", niveau: "3e" }` | `422`. Aucune ligne créée. |

### 7.3 CRUD matières

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| API-MAT-01 | P0 | `POST` `{ code: "MATH", libelle: "Mathématiques", coefficient: 4 }` | `201`. Coefficient 4 restitué sans perte de précision. |
| API-MAT-02 | P0 | Second `POST` avec `code: "MATH"` | `409`. |
| API-MAT-03 | P1 | `POST` `{ code: "FR", libelle: "Français", coefficient: 2 }` | `201`. |
| API-MAT-04 | P1 | `PATCH` coefficient de 4 vers 5 | `200`. Les moyennes **déjà consultées ensuite** utilisent 5. Les notes brutes ne changent pas. |
| API-MAT-05 | P0 | `DELETE` matière référencée par une évaluation | `409`. |
| API-MAT-06 | P1 | `POST` `{ coefficient: 0 }` | `422`. |
| API-MAT-07 | P1 | `POST` `{ coefficient: -1 }` | `422`. |
| API-MAT-08 | P2 | `GET` liste triée par libellé | Ordre alphabétique français : Français avant Mathématiques. |

### 7.4 CRUD évaluations

Précondition : `ens.math` affecté à 3e A · Mathématiques. Sauf mention, l'appel est fait par cet enseignant.

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| API-EVL-01 | P0 | `POST` `{ classeId: 3eA, matiereId: MATH, titre: "Devoir 1", coefficient: 4, noteMax: 20, date: "2025-10-15" }` | `201`. L'auteur est `ens.math`. |
| API-EVL-02 | P0 | Même charge utile par `ens.fr` | `403`. Aucune évaluation créée. |
| API-EVL-03 | P1 | Même charge utile par `administrateur` | `201`. |
| API-EVL-04 | P1 | `GET` des évaluations 3e A · Mathématiques | La liste contient Devoir 1 et exclut le français. |
| API-EVL-05 | P1 | `PATCH` `{ coefficient: 2, titre: "Devoir 1 bis" }` par l'enseignant affecté | `200`. |
| API-EVL-06 | P0 | `PATCH` du coefficient par `ens.fr` | `403`. Coefficient inchangé. |
| API-EVL-07 | P0 | `DELETE` évaluation qui a des notes | `409`. Notes intactes. |
| API-EVL-08 | P1 | `DELETE` évaluation sans note, par l'enseignant affecté | `204`. |
| API-EVL-09 | P1 | `POST` `{ coefficient: 0, noteMax: 20 }` | `422`. |
| API-EVL-10 | P1 | `POST` `{ noteMax: 0 }` | `422`. |
| API-EVL-11 | P1 | `POST` date `2025-13-40` | `422`. |

### 7.5 CRUD notes

Précondition : évaluation Maths « Devoir 1 », coef. 4, `noteMax` 20, élève Amina dans la 3e A. Acteur : `ens.math`.

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| API-NOT-01 | P0 | `POST` `{ evaluationId, eleveId: Amina, valeur: 15, statut: "present" }` | `201`. Valeur stockée `15.00`. |
| API-NOT-02 | P0 | Second `POST` Amina sur la même évaluation | `409`. La valeur reste 15. |
| API-NOT-03 | P0 | `POST` `{ valeur: 12 }` pour Boris sur la même évaluation | `201`. Indépendant de la note d'Amina. |
| API-NOT-04 | P1 | `GET` note par id | `200`, valeur 15, élève et évaluation joints. |
| API-NOT-05 | P1 | `GET` notes de l'évaluation | Amina 15 et Boris 12. Aucun élève d'une autre classe. |
| API-NOT-06 | P0 | `PATCH` Amina `{ valeur: 14 }` | `200`. L'audit conserve l'ancienne valeur 15 et la nouvelle 14 (voir checklist, journalisation). |
| API-NOT-07 | P0 | `PATCH` par `ens.fr` | `403`. Valeur inchangée. |
| API-NOT-08 | P1 | `DELETE` par `ens.math` | `204`. Un nouveau `POST` de la même paire redevient possible (`201`). |
| API-NOT-09 | P0 | `POST` `{ valeur: -0.01 }` | `422` côté API. Insertion SQL directe refusée par la contrainte (DB-NOT-03). |
| API-NOT-10 | P0 | `POST` `{ valeur: 20.01 }` avec `noteMax` 20 | `422`. Insertion SQL directe refusée (DB-NOT-04). |
| API-NOT-11 | P0 | `POST` `{ valeur: 0, statut: "present" }` | `201`. La moyenne compte ce 0. |
| API-NOT-12 | P0 | `POST` `{ valeur: 20, statut: "present" }` | `201`. |
| API-NOT-13 | P0 | `POST` `{ valeur: null, statut: "absent" }` | `201`. Moyenne : note exclue. |
| API-NOT-14 | P1 | `POST` `{ valeur: 15, statut: "absent" }` | `422`. Une absence n'a pas de valeur numérique. |
| API-NOT-15 | P1 | `POST` élève de la 3e B sur une évaluation de la 3e A | `422`. Aucune note créée. |
| API-NOT-16 | P1 | `GET` par `eleve.e01` de la note d'Amina, si E01 n'est pas Amina | `403` ou `404`. Le corps ne contient pas la note. |
| API-NOT-17 | P2 | `POST` `{ valeur: 15.456 }` | `422` (plus de 2 décimales) avant toute écriture. |

### 7.6 Validation des entrées

La validation de contrat est faite avec Zod avant toute écriture. Les cas suivants fixent des couples entrée / erreur.

| ID | P | Entrée | Sortie attendue |
|---|---|---|---|
| VAL-01 | P0 | Corps JSON `{}` sur création d'élève | `422`. Issues sur `matricule`, `nom`, `prenom`, `classeId`. |
| VAL-02 | P0 | `matricule: "  mat-2025-100  "` | Accepté après normalisation en `MAT-2025-100`, ou `422` si la normalisation n'est pas retenue. Le comportement choisi est unique sur toute l'API et couvert par un seul oracle. Valeur de référence de ce plan : trim + majuscules, puis `201`. |
| VAL-03 | P1 | `matricule: "A"` | `422`. Longueur minimale 4. |
| VAL-04 | P1 | `matricule` de 33 caractères | `422`. Longueur maximale 32. |
| VAL-05 | P1 | `nom: "   "` | `422`. |
| VAL-06 | P1 | `prenom` de 81 caractères | `422`. |
| VAL-07 | P1 | `classeId: "pas-un-uuid"` | `422`. |
| VAL-08 | P1 | Champ inconnu `{ matricule, nom, prenom, classeId, role: "administrateur" }` | `422` (objet strict) ou champ ignoré. Référence de ce plan : objet strict, `422`, aucun changement de rôle. |
| VAL-09 | P0 | `coefficient: "4"` (chaîne) | `422`, sauf coercition documentée. Référence : nombre seul, donc `422`. |
| VAL-10 | P1 | `coefficient: 1.234` | `422`. Au plus 2 décimales. |
| VAL-11 | P1 | `noteMax: -5` | `422`. |
| VAL-12 | P1 | Date de fin d'année antérieure à la date de début | `422`. |
| VAL-13 | P1 | `email: "ens.math"` | `422` à la création de compte. |
| VAL-14 | P1 | Mot de passe `court1` | `422`. Minimum 12 caractères. |
| VAL-15 | P2 | Corps qui n'est pas du JSON | `400`. Pas de `500`. |
| VAL-16 | P1 | Requête de recherche `q` de 200 caractères | `422` ou troncature documentée. Référence : `422` au-delà de 80 caractères. |

### 7.7 Authentification

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| AUTH-01 | P0 | Identifiant `admin@etab.test` et mot de passe correct | `200` ou redirection vers l'accueil authentifié. Cookie de session posé. Un appel suivant à une route privée renvoie `200`. |
| AUTH-02 | P0 | Bon identifiant, mot de passe `mauvais-mot-de-passe` | `401`. Aucun cookie de session. Message générique « Identifiants invalides », identique à AUTH-03. |
| AUTH-03 | P0 | Identifiant `inconnu@etab.test` | `401`. Même message et même forme de réponse que AUTH-02. |
| AUTH-04 | P0 | Compte désactivé, bon mot de passe | `403`. Aucune session. |
| AUTH-05 | P0 | Session expirée (date d'expiration dans le passé) | Route privée : `401`. |
| AUTH-06 | P0 | Déconnexion puis réutilisation du cookie capturé | `401`. |
| AUTH-07 | P1 | Succès de connexion alors qu'une session existait | L'identifiant de session change. L'ancien cookie est refusé. |
| AUTH-08 | P1 | Page de saisie des notes ouverte sans session | Redirection vers la connexion, ou `401` si l'appel est un fetch. Aucune note dans le HTML ni dans le JSON. |

### 7.8 Autorisation par rôle

Préconditions : notes de la classe témoin présentes ; `ens.math` affecté uniquement à 3e A · Mathématiques ; `ens.fr` affecté uniquement à 3e A · Français.

| ID | P | Acteur et action | Sortie attendue |
|---|---|---|---|
| AUTHZ-01 | P0 | `enseignant` `ens.math` modifie la note de maths d'Amina (15 → 14) | `200`. |
| AUTHZ-02 | P0 | `ens.math` modifie la note de français d'Amina | `403`. Valeur française inchangée. |
| AUTHZ-03 | P0 | `ens.math` crée une note sur une évaluation de la 3e B · Mathématiques | `403`. |
| AUTHZ-04 | P0 | `ens.math` supprime une évaluation de français | `403`. Évaluation toujours présente. |
| AUTHZ-05 | P0 | `ens.fr` lit les notes de français de la 3e A | `200`. |
| AUTHZ-06 | P1 | `ens.fr` lit les notes de maths de la 3e A | `403`. Corps sans notes. |
| AUTHZ-07 | P0 | `scolarite` crée un élève | `201`. |
| AUTHZ-08 | P0 | `scolarite` modifie une note | `403`. |
| AUTHZ-09 | P0 | `eleve` (Amina) lit ses notes | `200`. Uniquement ses lignes. |
| AUTHZ-10 | P0 | `eleve` (Amina) lit les notes de Boris via l'identifiant de Boris | `403` ou `404`, sans fuite de la note. |
| AUTHZ-11 | P0 | `eleve` envoie `PATCH` sur sa propre note | `403`. |
| AUTHZ-12 | P0 | `administrateur` modifie une note de français | `200`. |
| AUTHZ-13 | P1 | `enseignant` crée une classe | `403`. |
| AUTHZ-14 | P1 | `enseignant` crée une affectation pour lui-même sur une autre matière | `403`. |
| AUTHZ-15 | P0 | `ens.math`, affectation retirée, rejoue AUTHZ-01 | `403`. |

### 7.9 Calcul des moyennes

Niveau unitaire, fonction pure. Entrée : liste `{ valeur, coefficient, statut }`. Sortie : nombre arrondi ou `NC`.

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| UT-MOY-01 | P0 | `(15 × 4)` et `(12 × 2)` | `(60 + 24) / 6 = 14`. Affichage `14,00`. |
| UT-MOY-02 | P0 | Une seule note 18, coef. 4 | `18,00`. |
| UT-MOY-03 | P0 | Notes 20 coef. 4 et 0 coef. 2 | `(80 + 0) / 6 = 13,333…` → `13,33`. |
| UT-MOY-04 | P0 | Notes 10 coef. 1 et 10 coef. 1 | `10,00`. |
| UT-MOY-05 | P1 | Note 10 coef. 1, 10 coef. 2, 10 coef. 3 | `10,00`. |
| UT-MOY-06 | P0 | Liste vide | `NC`. |
| UT-MOY-07 | P0 | Une seule note, statut absent, coef. 4 | `NC`. Le coefficient 4 n'est pas un dénominateur. |
| UT-MOY-08 | P0 | 18 présente coef. 4, absente coef. 2 | `18,00`. Denominateur 4, pas 6. |
| UT-MOY-09 | P1 | 15 coef. 4, 12 coef. 2, absente coef. 1 | Identique à UT-MOY-01 : `14,00`. |
| UT-MOY-10 | P1 | Valeur 10,005 avec un seul coefficient | `10,01` (half-up, 3e décimale 5). |
| UT-MOY-11 | P1 | Valeur exacte 10,004 | `10,00`. |
| UT-MOY-12 | P0 | Somme des coefficients des notes présentes = 0 (ne doit pas arriver si VAL refuse le coef.) | `NC`, aucune exception, aucun `Infinity`. |
| UT-MOY-13 | P0 | Moyenne générale Amina : maths `14,00` coef. 4, français `16,00` coef. 2 | `(56 + 32) / 6 = 14,666…` → `14,67`. |
| UT-MOY-14 | P0 | Moyenne générale E02 : maths `NC`, français `12,00` coef. 2 | `12,00`. Le coefficient de maths est absent du dénominateur. |
| UT-MOY-15 | P1 | Les deux matières `NC` | `NC`. |
| UT-MOY-16 | P1 | Note 19,99 et note 20, coef. égaux, `noteMax` 20 | `(39,99) / 2 = 19,995` → `20,00`. |
| UT-MOY-17 | P2 | 30 notes égales à 10, coef. 2 | `10,00`. |

Oracle indépendant pour UT-MOY-01, à recalculer à la main avant d'accepter une implémentation : `15×4 = 60`, `12×2 = 24`, somme `84`, diviseur `6`, quotient `14`.

### 7.10 Classements et ex æquo

Entrée : liste `{ eleve, moyenne }` où `moyenne` est déjà arrondie ou vaut `NC`.

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| UT-RNK-01 | P0 | Chloé 18,00 ; Amina 14,00 ; Boris 14,00 ; Émile 13,33 ; David NC | Rangs `1, 2, 2, 4`, David `NC`. |
| UT-RNK-02 | P0 | Trois élèves à 15,00 | Tous rang `1`. Aucun rang 2 ni 3 n'est attribué. |
| UT-RNK-03 | P0 | 15,00 puis 14,00 puis 14,00 puis 13,00 | Rangs `1, 2, 2, 4`. |
| UT-RNK-04 | P1 | Un seul élève à 9,00 | Rang `1`. |
| UT-RNK-05 | P1 | Tous `NC` | Aucun rang numérique. Effectif classé = 0. |
| UT-RNK-06 | P1 | 10,666… et 10,670 saisis bruts | Après arrondi, les deux valent `10,67` et partagent le rang. |
| UT-RNK-07 | P1 | 10,67 et 10,66 | Rangs distincts, `10,67` devant. |
| UT-RNK-08 | P2 | Amina Kane 14,00 et Boris Ndiaye 14,00 | Même rang. Affichage : Kane avant Ndiaye. |
| UT-RNK-09 | P0 | Classe volume, moyennes générales de la section 3.5 | E01 rang 1 ; E02 rang 2 ; E03–E29 rang 3 ; E30 rang 30. |
| UT-RNK-10 | P1 | Ajout d'un élève NC au classement UT-RNK-01 | Les rangs 1, 2, 2, 4 restent identiques. |

La méthode « 1, 2, 2, 3 » (rang dense) est un échec de UT-RNK-01 et de UT-RNK-03.

### 7.11 Notes absentes

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| ABS-01 | P0 | Amina 15 coef. 4, Boris absent coef. 4, même évaluation | Moyenne de l'évaluation : `15,00` sur 1 copie, pas sur 2. L'absence ne vaut pas 0. |
| ABS-02 | P0 | David absent aux deux évaluations de maths | Moyenne maths `NC`. Il n'apparaît pas avec 0,00. |
| ABS-03 | P1 | Passage d'une note 12 au statut absent | La moyenne est recalculée sans cette note. L'ancienne valeur 12 n'entre plus dans la somme. |
| ABS-04 | P1 | Passage d'une absence à la valeur 0 | La moyenne baisse : le 0 et son coefficient entrent dans le calcul. |
| ABS-05 | P1 | Écran de saisie : case « Absent » cochée | Le champ numérique est vidé et non soumis. Enregistrement `statut=absent`, `valeur=null`. |
| ABS-06 | P2 | Bulletin de David | Libellé `Absent` ou `NC` par évaluation, moyenne `NC`, mention de rang absente. |
| ABS-07 | P1 | Statistiques de classe témoin en maths | Copies comptées : Amina, Boris, Chloé, Émile (4). Absences : David sur les deux évaluations, Chloé sur le coef. 2. La moyenne de classe des moyennes de maths n'inclut pas David : `(14 + 14 + 18 + 13,33) / 4 = 59,33 / 4 = 14,8325` → `14,83`. |

### 7.12 Contraintes de base

Ces cas s'exécutent en SQL sur la base de test, puis une seconde fois via l'API pour vérifier que le code HTTP correspond. Les noms de colonnes sont ceux du schéma livré par l'architecture ; les propriétés métier ci-dessous sont l'oracle.

| ID | P | Entrée SQL / API | Sortie attendue |
|---|---|---|---|
| DB-ELV-01 | P0 | Deux élèves, matricule `MAT-2025-001` | Deuxième insertion rejetée. Code SQL d'unicité (`23505`). API : `409`. Nombre de lignes = 1. |
| DB-NOT-01 | P0 | Deux notes, même `eleve_id` et même `evaluation_id` | Deuxième insertion rejetée. Unicité de la paire. API : `409`. |
| DB-NOT-02 | P1 | Deux notes, même élève, deux évaluations différentes | Les deux lignes existent. |
| DB-NOT-03 | P0 | `valeur = -0.01`, statut présent | `CHECK` refusé (`23514`). API : `422`. Ligne absente. |
| DB-NOT-04 | P0 | `valeur = noteMax + 0.01` | `CHECK` refusé. API : `422`. |
| DB-NOT-05 | P0 | `valeur = 0` | Accepté. |
| DB-NOT-06 | P0 | `valeur = noteMax` | Accepté. |
| DB-NOT-07 | P0 | `valeur IS NULL` et statut `absent` | Accepté. Le `CHECK` ne s'applique qu'aux valeurs non nulles. |
| DB-NOT-08 | P1 | `valeur IS NULL` et statut `present` | Refusé, en base et en API (`422`). |
| DB-NOT-09 | P1 | `valeur = 12` et statut `absent` | Refusé. |
| DB-AFF-01 | P1 | Deux affectations identiques enseignant + classe + matière + année | Deuxième rejetée, unicité. |
| DB-CLS-01 | P1 | Suppression d'une classe dont l'identifiant est encore référencé par un élève | Refus de clé étrangère, ou refus applicatif `409` si la suppression est interceptée avant. Aucun élève orphelin. |
| DB-EVL-01 | P1 | `coefficient <= 0` ou `noteMax <= 0` | `CHECK` refusé. |

Contrôle de non-contournement : DB-NOT-03 et DB-NOT-04 restent rouges si l'API est contournée par un client SQL de test. Une validation Zod seule, sans contrainte SQL, ne satisfait pas ces cas.

### 7.13 Formulaires

Écrans : année scolaire, classe, élève, matière, évaluation, affectation, connexion.

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| FE-FRM-01 | P1 | Soumission du formulaire élève vide | Aucun appel d'écriture. Erreurs visibles sur matricule, nom, prénom, classe. Le focus va au premier champ invalide. |
| FE-FRM-02 | P1 | Matricule déjà utilisé, reste du formulaire valide | Le serveur répond `409`. Le formulaire affiche « Ce matricule existe déjà » et conserve les autres champs saisis. |
| FE-FRM-03 | P1 | Double clic sur « Enregistrer » | Une seule requête d'écriture. Le bouton est inactif pendant l'envoi. |
| FE-FRM-04 | P2 | Erreur réseau simulée | Message « Enregistrement impossible ». Les données restent à l'écran. Aucun toast de succès. |
| FE-FRM-05 | P1 | Coefficient `0` dans le formulaire matière | Erreur de champ avant envoi, ou erreur `422` affichée sous le champ. Aucune matière créée. |
| FE-FRM-06 | P1 | Année : début `2025-09-01`, fin `2025-08-31` | Erreur « La fin est postérieure au début ». |
| FE-FRM-07 | P2 | Échap ou « Annuler » après modification | Aucune écriture. Retour à la liste. |
| FE-FRM-08 | P1 | Connexion : champs vides | Erreurs de champ. Pas d'appel, ou appel refusé sans créer de session. |

### 7.14 Tableaux

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| FE-TAB-01 | P1 | Liste de 30 élèves | Pagination visible. Taille de page par défaut 25 : page 1 = 25 lignes, page 2 = 5 lignes. Total affiché = 30. |
| FE-TAB-02 | P1 | Tri sur le nom | Ordre alphabétique croissant, puis décroissant au second clic. Le tri ne perd pas le filtre de classe actif. |
| FE-TAB-03 | P1 | Classe sans élève | État vide « Aucun élève » et action « Ajouter un élève » pour un rôle autorisé. Pas de tableau cassé. |
| FE-TAB-04 | P2 | Colonne moyenne | `14,00`, `NC` alignés. `NC` n'est pas trié comme 0 : en tri décroissant, les moyennes numériques précèdent `NC`. |
| FE-TAB-05 | P1 | Ligne d'un élève | Le lien ouvre la fiche du même matricule. |
| FE-TAB-06 | P2 | Pendant le chargement | Indicateur d'attente. Aucune ligne périmée d'une classe précédente. |

### 7.15 Recherche

| ID | P | Entrée `q` | Sortie attendue |
|---|---|---|---|
| FE-RCH-01 | P1 | `Kane` | Amina Kane. Boris Ndiaye absent. |
| FE-RCH-02 | P1 | `mat-2025-001` | E01 uniquement, recherche insensible à la casse. |
| FE-RCH-03 | P1 | `Ber` | Chloé Bernard (préfixe de nom). |
| FE-RCH-04 | P1 | `zzz` | Liste vide et message « Aucun résultat ». Code HTTP `200` avec tableau vide, pas `404`. |
| FE-RCH-05 | P0 | `' OR 1=1 --` | `200` avec 0 ligne, ou `422`. Jamais la liste complète. Voir SEC-SQL-02. |
| FE-RCH-06 | P1 | `  Kane  ` | Même résultat que `Kane`. |
| FE-RCH-07 | P2 | Recherche puis changement de classe dans le filtre | La requête combine recherche et classe. Un homonyme d'une autre classe n'apparaît pas. |

### 7.16 Filtres

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| FE-FIL-01 | P1 | Année `2025-2026` | Classes et évaluations de `2026-2027` masquées. |
| FE-FIL-02 | P1 | Classe 3e A | Élèves de la 3e B absents. |
| FE-FIL-03 | P1 | Matière Mathématiques | Évaluations de français absentes. Les moyennes affichées sont celles de maths. |
| FE-FIL-04 | P1 | Combinaison 3e A + Mathématiques + période du 1er trimestre (`2025-09-01` → `2025-12-15`) | Seules les évaluations de maths de la 3e A dont la date tombe dans l'intervalle. |
| FE-FIL-05 | P1 | Réinitialiser les filtres | Retour au défaut : année active, aucune matière forcée, liste cohérente avec ce défaut. |
| FE-FIL-06 | P2 | Filtre dans l'URL, rechargement de la page | Les mêmes filtres sont réappliqués. |
| FE-FIL-07 | P1 | `ens.math` ouvre le filtre des matières | Mathématiques est proposé. Français ne l'est pas, ou sa sélection renvoie un état vide autorisé (`403` sur l'API). |

### 7.17 Saisie des notes

Écran : grille d'une évaluation, une ligne par élève de la classe.

| ID | P | Entrées | Sortie attendue |
|---|---|---|---|
| FE-SAI-01 | P0 | Évaluation maths 3e B, 30 élèves sans note | 30 lignes. Champs vides. Aucune moyenne affichée autre que `NC`. |
| FE-SAI-02 | P0 | Saisie `15` pour E01, `10` pour E03, absence pour E02, enregistrement | Trois persistances conformes à API-NOT-01 / API-NOT-13. Rechargement : les mêmes valeurs. |
| FE-SAI-03 | P0 | Valeur `21` alors que `noteMax` est 20 | La ligne est signalée invalide. L'enregistrement global n'écrit pas cette ligne. Les lignes valides du même envoi sont traitées selon la règle atomique retenue : référence de ce plan, **rejet de tout le lot** `422`, base inchangée. |
| FE-SAI-04 | P0 | Valeur `-1` | Même rejet que FE-SAI-03. |
| FE-SAI-05 | P1 | Valeur `0` | Acceptée et distinguée visuellement d'une cellule vide. |
| FE-SAI-06 | P1 | Navigation clavier : flèche bas | Le focus passe à l'élève suivant sans soumettre la page. |
| FE-SAI-07 | P1 | `ens.fr` ouvre la grille de maths | Accès refusé. Grille non affichée, aucune valeur préremplie dans le code HTML. |
| FE-SAI-08 | P1 | Deux enseignants n'ouvrent pas la même grille. Un enseignant enregistre `15`, recharge. | Dernière valeur lue = 15. Un second onglet encore ouvert sur l'ancienne valeur, s'il enregistre `12` sans relecture, reçoit `409` `CONFLIT_VERSION`. La valeur en base reste `15` tant que le client n'a pas rechargé. |
| FE-SAI-09 | P2 | Colonne « note / max » | Affiche `/ 20` ou le `noteMax` de l'évaluation. |
| FE-SAI-10 | P1 | Élève transféré hors de la classe après ouverture de la grille, puis enregistrement | La ligne de cet élève est refusée (`422`). Les autres notes du lot suivent FE-SAI-03 (rejet du lot). |

## 8. Scénarios métier de bout en bout

Les scénarios E2E-01 à E2E-11 s'enchaînent sur un établissement vide de l'année `2025-2026`. Chacun est aussi exécutable seul si son prérequis de données est chargé par le seed. L'acteur est indiqué à chaque étape. L'outil d'exécution est Playwright, avec assertions sur l'interface **et** sur l'API ou la base.

Compte rendu attendu d'une campagne : les 11 statuts, les captures d'échec, et les moyennes lues à l'écran comparées à la section 3.5.

### E2E-01 — Création de l'année scolaire

| | |
|---|---|
| Acteur | `administrateur` |
| Entrées | Libellé `2025-2026`, début `2025-09-01`, fin `2026-07-15`, année marquée active |
| Étapes | Connexion. Ouverture du référentiel. Saisie du formulaire. Enregistrement. Retour à la liste. |
| Sortie attendue | Une ligne `2025-2026`, statut active. `GET` correspondant : dates exactes. Une seconde année aux dates inversées est impossible (FE-FRM-06). |

### E2E-02 — Création de la classe

| | |
|---|---|
| Acteur | `administrateur` |
| Prérequis | E2E-01 |
| Entrées | Nom `3e B`, niveau `3e`, année `2025-2026` |
| Sortie attendue | La classe apparaît dans le filtre de l'année active. Elle n'apparaît pas si le filtre passe sur une autre année. Effectif affiché : 0. |

### E2E-03 — Création de 30 élèves

| | |
|---|---|
| Acteur | `scolarite` |
| Prérequis | E2E-02 |
| Entrées | E01…E30, matricules `MAT-2025-001` … `MAT-2025-030`, noms `Eleve01` … `Eleve30`, prénom `Test`, classe 3e B. Le 31e essai réutilise `MAT-2025-001`. |
| Sortie attendue | Tableau : 30 élèves, pagination 25 + 5. Le matricule dupliqué est refusé (`409`) et le total reste 30. Recherche `MAT-2025-030` → une ligne. |

### E2E-04 — Création des matières

| | |
|---|---|
| Acteur | `administrateur` |
| Entrées | `MATH` / Mathématiques / coefficient 4 ; `FR` / Français / coefficient 2 |
| Sortie attendue | Deux matières. Second enregistrement du code `MATH` refusé. Coefficients 4 et 2 relus sans arrondi. |

### E2E-05 — Création de l'enseignant

| | |
|---|---|
| Acteur | `administrateur` |
| Entrées | Compte `ens.math@etab.test`, rôle `enseignant`, nom `Martin`, prénom `Léa`, mot de passe de test d'au moins 12 caractères |
| Sortie attendue | Le compte se connecte. Sans affectation, la liste des classes à saisir est vide. Un élève ne peut pas être créé avec ce rôle (AUTHZ-13). |

### E2E-06 — Affectation

| | |
|---|---|
| Acteur | `administrateur` pour l'écriture ; `ens.math` pour la vérification |
| Prérequis | E2E-02, E2E-04, E2E-05 |
| Entrées | Léa Martin → 3e B → Mathématiques → `2025-2026`. Puis une seconde affectation identique. |
| Sortie attendue | Première affectation `201`. Doublon `409` (DB-AFF-01). Après connexion de Léa, la 3e B · Mathématiques est proposée. La 3e B · Français ne l'est pas. |

### E2E-07 — Création de l'évaluation

| | |
|---|---|
| Acteur | `ens.math` |
| Prérequis | E2E-06 |
| Entrées | Titre `Devoir 1`, classe 3e B, matière Mathématiques, date `2025-10-15`, coefficient 2, `noteMax` 20. Tentative parallèle : `ens.math` crée un devoir de français. |
| Sortie attendue | L'évaluation de maths existe. La tentative français renvoie `403` et n'apparaît pas dans la liste. `scolarite` voit l'évaluation en lecture et ne voit pas d'action « Saisir les notes ». |

### E2E-08 — Saisie des notes

| | |
|---|---|
| Acteur | `ens.math` |
| Prérequis | E2E-03, E2E-07 |
| Entrées | Grille des 30 élèves : E01 = 15, E02 = absent, E03 à E30 = 10. Puis un correctif E30 = 10 confirmé (déjà 10). Tentative de saisie `21` annulée et resaisie à 10. |
| Sortie attendue | 29 notes présentes et 1 absence. Rechargement fidèle. La valeur 21 n'est jamais persistée. `ens.fr`, s'il est créé sans cette affectation, reçoit `403` sur la même grille. Contrôle base : 30 lignes note au plus, une par élève (DB-NOT-01). |

Pour enchaîner E2E-09 à E2E-11 sur le jeu complet de la section 3.5, le seed (ou une étape complémentaire jouée par `administrateur` et `ens.fr`) ajoute ensuite :

- l'évaluation de français coef. 1, notes E01 = 12, E02 = 12, E03–E29 = 12, E30 = 8 ;
- l'affectation français n'est pas donnée à `ens.math`.

### E2E-09 — Moyennes

| | |
|---|---|
| Acteur | `scolarite` en lecture, après la saisie |
| Prérequis | E2E-08 et le complément français décrit ci-dessus |
| Entrées | Ouverture du bilan 3e B |
| Sortie attendue | E01 maths `15,00`, français `12,00`, générale **14,00**. E02 maths `NC`, français `12,00`, générale **12,00**. E03 générale **10,67**. E30 générale **9,33**. Le cas unitaire UT-MOY-01 reste vert sur la classe témoin dans la même campagne : **14,00**. Aucune moyenne d'absence n'est affichée comme `0,00`. |

### E2E-10 — Classement

| | |
|---|---|
| Acteur | `scolarite` |
| Prérequis | E2E-09 |
| Entrées | Écran classement de la moyenne générale, 3e B, année active |
| Sortie attendue | Rang 1 : E01 (`14,00`). Rang 2 : E02 (`12,00`). Rang 3 : E03 à E29. Rang 30 : E30 (`9,33`). Les 27 élèves à `10,67` portent tous le rang 3. E04 n'est pas rang 4. Export ou copie d'écran : 30 lignes, une par élève. |

### E2E-11 — Statistiques

| | |
|---|---|
| Acteur | `administrateur` |
| Prérequis | E2E-10 |
| Entrées | Écran statistiques de la 3e B, indicateur = moyenne générale |
| Sortie attendue | Les huit indicateurs et cinq tranches de la section 3.5, dont moyenne de classe **10,78**, médiane **10,67**, minimum **9,33**, maximum **14,00**, taux ≥ 10 = **96,67 %**, une absence de note en maths. Changer le filtre vers la classe témoin n'affiche pas les chiffres de la 3e B. `eleve.e01` ne peut pas ouvrir cet écran de classe (`403`). |

### 8.1 Scénario intégré

Une seule exécution Playwright enchaîne E2E-01 → E2E-11 sans réinitialiser la base entre les étapes. Durée cible indicative : le scénario reste dans le budget CI (moins de 5 minutes sur le projet de test). Échec dès la première assertion fausse, base de test conservée en artefact CI pour diagnostic.

## 9. Traçabilité

| Exigence | Cas |
|---|---|
| Créer, lire, modifier, supprimer un élève | API-ELV-01 à 10, E2E-03 |
| Créer, lire, modifier, supprimer une classe | API-CLS-01 à 08, E2E-02 |
| Créer, lire, modifier, supprimer une matière | API-MAT-01 à 08, E2E-04 |
| Créer, lire, modifier, supprimer une évaluation | API-EVL-01 à 11, E2E-07 |
| Créer, lire, modifier, supprimer une note | API-NOT-01 à 17, FE-SAI-01 à 10, E2E-08 |
| Valider les entrées | VAL-01 à 16, FE-FRM-01 à 08 |
| Authentifier | AUTH-01 à 08 |
| Autoriser par rôle | AUTHZ-01 à 15 |
| Moyenne `(15×4 + 12×2) / (4+2) = 14` | UT-MOY-01, E2E-09 |
| Ex æquo | UT-RNK-01, UT-RNK-03, UT-RNK-09, E2E-10 |
| Notes absentes | UT-MOY-06 à 09, ABS-01 à 07, API-NOT-13 |
| Matricule dupliqué | API-ELV-02, DB-ELV-01, E2E-03 |
| Doublon élève / évaluation | API-NOT-02, DB-NOT-01 |
| Note négative | API-NOT-09, DB-NOT-03, FE-SAI-04 |
| Note supérieure au maximum | API-NOT-10, DB-NOT-04, FE-SAI-03 |
| Formulaires, tableaux, recherche, filtres | FE-FRM, FE-TAB, FE-RCH, FE-FIL |
| Année, classe, 30 élèves, matières, enseignant, affectation, évaluation, notes, moyennes, classement, statistiques | E2E-01 à E2E-11 |

## 10. Points d'attention

1. **Arrondi en cascade.** La moyenne générale d'Émile utilise `13,33` déjà arrondi, pas la fraction `80/6`. Changer cette convention modifie `12,55` et uniquement les cas qui empilent deux arrondis (UT-MOY-13 reste sur des valeurs déjà rondes pour Amina).
2. **Méthode de rang.** La référence est 1, 2, 2, 4. Un rang dense ferait échouer E2E-10 (E30 serait rang 4 au lieu de 30).
3. **Absence.** L'absence est exclue du calcul. La traiter comme un zéro ferait échouer ABS-01, ABS-02 et la moyenne générale d'E02 (`12,00`).
4. **Atomicité de la grille.** Le lot entier est refusé si une cellule est invalide (FE-SAI-03). Une politique « enregistrer les lignes valides » exige une révision explicite de ce cas.
5. **Suppression.** Aucune cascade sur les notes. Une décision d'architecture contraire exige de réécrire API-ELV-08, API-CLS-06 et API-EVL-07.
6. **Normalisation du matricule.** La référence est trim + majuscules (VAL-02).
7. **Concurrence de saisie.** La référence est le `409` de version (FE-SAI-08), pas le dernier écrit silencieux.
8. **Noms physiques.** Les colonnes SQL réelles primeront sur les noms de ce plan dès la livraison du schéma. Les oracles chiffrés, eux, ne dépendent pas des noms de colonnes.
9. **Données de production.** Aucune campagne ne s'exécute sur la base de production ni sur une preview branchée à cette base.
10. **Écart avec `index.html`.** Le fichier racine actuel est un analyseur de JSON hors domaine notes. Il n'est pas une oracle de test.

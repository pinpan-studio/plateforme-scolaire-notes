# Frontend — contrat d'interface

L'interface vit dans `src/components/**`, `src/app/(app)/**`, `src/app/(auth)/**`, `src/lib/api-client/**` et les styles Tailwind. Elle n'implémente pas les Route Handlers, l'authentification, le middleware, ni les formules de `src/lib/grading/`.

Les chiffres publiés (résultats, bulletins, analyses, fiche élève) viennent de l'API. Tout affichage calculé dans l'interface importe `src/lib/grading` : l'aperçu de la grille appelle `computeSubjectAverage` et `appreciate`, la légende d'aide appelle `listAppreciationBands`, le seuil « sous la moyenne » est `PASS_MARK`. Aucune page ne recopie la pondération, l'arrondi ou le barème.

## 1. Décisions

| Sujet | Décision |
| --- | --- |
| Session | `GET /api/session`. Un 401 redirige vers `/connexion`. Le frontend ne pose pas de middleware. |
| Année affichée | Query `anneeId`. À défaut, l'année `EN_COURS` de la session. Le choix est mémorisé dans `localStorage` (`cahier.anneeId`). |
| Établissement avant connexion | `GET /api/public/etablissement` renvoie `{ nom }`. Si l'appel échoue, le titre reste « Cahier de notes », sans nom inventé. |
| Erreurs | Corps `{ code, message, champs?: { champ, message }[] }`. Si `message` est présent, l'interface l'affiche. Sinon elle retombe sur la table du § 3. |
| Pagination | `page` commence à 1, `pageSize` vaut 25. Réponse `{ items, total, page, pageSize }`. |
| Recherche des listes | Paramètre `q` traité par l'API, pour couvrir toute la liste et pas seulement la page visible. La grille de notes filtre en local. |
| Tri | `tri` (clé de colonne) et `ordre` (`asc` ou `desc`). |
| Écriture direction | Les boutons de structure (classes, élèves, matières, enseignants, affectations, années, périodes) suivent la spec UX : la direction peut écrire. L'API peut encore refuser. L'établissement et les comptes restent réservés à l'admin. La direction ne modifie pas une note. |
| Clôture | La grille affiche `motifLectureSeule` et se verrouille quand `peutModifier` est faux. L'admin peut encore corriger si l'API renvoie `peutModifier: true` (règle 20 de l'analyse). La spec UX qui fige aussi l'admin est donc respectée dès que l'API le dit. |
| Sexe | Le schéma n'a que `F` et `M`. « Non renseigné » n'est pas proposé. |
| Statut élève | L'UI parle d'inscription : Inscrit, Sorti, Transféré. « Radié » de la spec UX correspond à `SORTI`. |
| Type d'évaluation | `DEVOIR` Devoir, `INTERROGATION` Contrôle, `COMPOSITION` Composition. Pas d'oral : le schéma ne l'a pas. |
| Année | `PREPARATION` Brouillon, `EN_COURS` Active, `CLOTUREE` Clôturée. |
| Note effacée | Une ligne ni absente ni chiffrée n'existe pas en base. L'envoi porte `supprimer: true` pour demander la suppression. |
| Collage tableur | Collage presse-papiers dans la grille (une colonne de notes, ou note + commentaire, ou note + absence + commentaire). Pas d'import de fichier. |
| Rang | Affiché tel que l'API le publie. Le module `rankCompetition` produit un rang de compétition (1, 2, 2, 4 ; un ex æquo en tête donne 1, 1, 3). Présentation `2e / 30`, `1er / 30`. |
| Aperçu de saisie | La grille montre la moyenne de l'évaluation en cours, recalculée à chaque frappe par `computeSubjectAverage` (notes valides et absences seulement). Ce n'est pas la moyenne de matière publiée. |
| Appréciation générale | Texte libre du professeur principal, distinct de l'appréciation calculée. `PUT /api/appreciations-generales`. |
| Bulletins | Écran `/bulletins`. Les résultats de classe (classement, matières, évolution) sont sur `/resultats`. `/statistiques` redirige vers `/analyses`. |
| Synthèse | `/synthese` choisit la classe. `/classes/[id]/synthese` ouvre la même vue. |
| Période vide | Omettre `periodeId` signifie l'année entière. |
| Nombres | JSON en nombre. L'affichage met une virgule et deux décimales pour une moyenne (`14,00`). |

## 2. Routes

Toutes les réponses d'erreur suivent le corps du § 1. Les lectures filtrées par rôle ne renvoient que le périmètre autorisé (l'enseignant ne reçoit pas les classes hors affectation).

| Méthode et chemin | Rôle |
| --- | --- |
| `GET /api/public/etablissement` | Public. `{ nom }` |
| `POST /api/auth/connexion` | `{ email, motDePasse }` → session. 401 `IDENTIFIANTS_INVALIDES`. 403 `COMPTE_DESACTIVE` |
| `POST /api/auth/deconnexion` | 204 |
| `GET /api/session` | Session, années, année active |
| `GET /api/etablissement` | Fiche complète |
| `PATCH /api/etablissement` | `{ nom, adresse, telephone, email }` |
| `GET /api/annees` | Tableau d'années |
| `POST /api/annees` | `{ libelle, dateDebut, dateFin }` |
| `POST /api/annees/:id/activer` | Une seule année `EN_COURS` |
| `POST /api/annees/:id/cloturer` | Passe à `CLOTUREE` |
| `GET /api/niveaux` | Niveaux ordonnés |
| `GET /api/periodes?anneeId` | Trimestres de l'année |
| `POST /api/periodes` | `{ anneeScolaireId, libelle, ordre, dateDebut, dateFin }` |
| `GET /api/classes` | Page de classes. Filtres `q`, `niveauId`, `anneeId` |
| `POST /api/classes` | `{ nom, niveauId, anneeScolaireId, professeurPrincipalId }` |
| `GET /api/classes/:id` | Détail : élèves, enseignements, professeur principal |
| `PATCH /api/classes/:id` | Même corps que la création |
| `GET /api/classes/:id/synthese` | Moyennes de matières et élèves. `periodeId` optionnel |
| `GET /api/eleves` | Page. Filtres `q`, `classeId`, `statut`, `anneeId` |
| `POST /api/eleves` | Voir `EleveEnvoi`. 409 `MATRICULE_DEJA_UTILISE` |
| `GET /api/eleves/:id?anneeId` | Fiche, résultats, historique. `dateNaissance` et `sexe` nuls si le rôle ne doit pas les voir |
| `PATCH /api/eleves/:id` | Même corps |
| `GET /api/enseignants` | Page. Filtre `q`, `statut` |
| `POST /api/enseignants` | `{ nom, prenom, email, telephone, statut }` |
| `PATCH /api/enseignants/:id` | Même corps |
| `GET /api/matieres` | Page. Filtres `q`, `niveauId` |
| `POST /api/matieres` | `{ code, nom, coefficient, niveauId }` (`niveauId` nul = tous les niveaux) |
| `PATCH /api/matieres/:id` | Même corps |
| `GET /api/affectations` | Page. Filtres `anneeId`, `classeId`, `matiereId`, `enseignantId` |
| `POST /api/affectations` | `{ enseignantId, classeId, matiereId, anneeScolaireId }`. 409 `AFFECTATION_DOUBLON` |
| `DELETE /api/affectations/:id` | 204 |
| `GET /api/evaluations` | Page. Filtres `q`, `classeId`, `matiereId`, `periodeId`, `anneeId` |
| `POST /api/evaluations` | Voir `EvaluationEnvoi`. 403 `HORS_AFFECTATION` si l'enseignant n'est pas affecté |
| `GET /api/evaluations/:id` | Détail, `supprimable`, `motifSuppression` |
| `PATCH /api/evaluations/:id` | Même corps que la création |
| `DELETE /api/evaluations/:id` | 409 `SUPPRESSION_IMPOSSIBLE` si des notes existent |
| `GET /api/evaluations/:id/notes` | Grille. `peutModifier`, `motifLectureSeule`, une ligne par élève inscrit |
| `PUT /api/evaluations/:id/notes` | `{ lignes: LigneNoteEnvoi[] }` → `{ message, grille }`. 409 `NOTE_DOUBLON` |
| `GET /api/resultats` | Classement de classe. `classeId` requis, `periodeId` optionnel, `anneeId` |
| `GET /api/bulletins/:eleveId` | Bulletin calculé. `reduitAuxMatieres` vrai pour un enseignant simple |
| `PUT /api/appreciations-generales` | `{ eleveId, periodeId, texte }` |
| `GET /api/tableau-de-bord?anneeId` | Indicateurs du rôle, listes éventuellement vides |
| `GET /api/analyses/distribution` | Tranches du barème, effectifs |
| `GET /api/analyses/matieres` | Moyenne par matière |
| `GET /api/analyses/evolution` | Moyenne de classe par trimestre |
| `GET /api/analyses/sous-seuil` | `seuil` défaut 10. Élèves strictement sous le seuil |
| `GET /api/utilisateurs` | Admin |
| `POST /api/utilisateurs` | Crée le compte. Réponse avec `motDePasseTemporaire` affiché une seule fois |
| `PATCH /api/utilisateurs/:id` | `{ actif, role, enseignantId }` |
| `POST /api/utilisateurs/:id/mot-de-passe-temporaire` | `{ motDePasseTemporaire }` |
| `PATCH /api/profil/mot-de-passe` | `{ motDePasseActuel, nouveauMotDePasse }` |

Les séries d'analyses n'incluent pas de points fictifs : un effectif à zéro est un vrai zéro, une moyenne absente est `null`.

### Grille

`LigneNoteEnvoi` : `{ eleveId, valeur, absent, commentaire, supprimer }`.

- Absent : `absent: true`, `valeur: null`, `supprimer: false`.
- Note : `absent: false`, `valeur` entre 0 et `noteMax` inclus, `supprimer: false`.
- Effacement : `supprimer: true`, `valeur: null`, `absent: false`.

L'interface n'envoie pas les lignes inchangées encore vides. Elle bloque l'envoi local si une saisie est négative, au-dessus du maximum, ou non numérique.

### Tableau de bord

`indicateurs` est une liste `{ id, libelle, valeur, href }` déjà filtrée par le rôle. L'interface ne fabrique pas de chiffre. Les graphiques du tableau de bord rappellent les routes d'analyses, pas une série locale.

Champs utiles selon le rôle, tous présents (liste vide ou `null` si sans objet) :

- `evaluationsASaisir`, `affectations`, `dernierEnregistrement` : enseignant et professeur principal.
- `appreciationsManquantes` : professeur principal.
- `classesEnDifficulte` : direction, admin, consultation.
- `alerteSansDirection` : admin.

## 3. Messages de repli

| Code | Message |
| --- | --- |
| `IDENTIFIANTS_INVALIDES` | E-mail ou mot de passe incorrect. |
| `COMPTE_DESACTIVE` | Ce compte est désactivé. Contactez l'administration. |
| `SESSION_EXPIREE`, `NON_AUTHENTIFIE` | Votre session a expiré. Reconnectez-vous. |
| `HORS_AFFECTATION` | Cette classe ou cette matière ne vous est pas affectée. |
| `MATRICULE_DEJA_UTILISE` | Ce matricule est déjà attribué à un élève. |
| `AFFECTATION_DOUBLON` | Cette affectation existe déjà. |
| `NOTE_DOUBLON` | Cette note existe déjà. Rechargez la page. |
| `SUPPRESSION_IMPOSSIBLE` | Des notes sont déjà saisies. La suppression est impossible. |
| `PERIODE_CLOTUREE` | Période clôturée. Les notes ne sont plus modifiables. |
| `REOUVERTURE_INTERDITE` | Seule l'administration peut rouvrir une année clôturée. |
| `ELEVE_DEJA_NOTE` | Impossible de déplacer un élève qui possède déjà des notes. |
| `NOTE_MAX_FIGEE`, `EVALUATION_DEJA_NOTEE` | Impossible de modifier la classe, la matière, la période ou la note maximale tant que des notes existent. |

Ces quatre messages sont ceux de `error.message`. L'interface les affiche tels quels. Le repli de la table ne sert que si le corps n'a pas de message. `FORBIDDEN` sur `PATCH /api/annees/:id` reste « Action interdite pour ce rôle. »

Quand l'année est `CLOTUREE` et que le rôle n'est pas `ADMIN`, le bouton Activer reste visible mais inactif, avec ce texte. Quand `saisies` est supérieur à 0, la classe, la matière, la période et la note maximale du formulaire d'évaluation sont désactivées, avec le même texte. La fiche élève ne désactive pas la classe : l'API n'expose pas « notes dans la classe quittée » (l'historique mélange toutes les notes de l'élève).

Échec réseau au chargement : « Impossible de charger les données. » Échec réseau à l'enregistrement des notes : « L'enregistrement a échoué. Vos saisies sont encore sur cette page. Réessayez. »

## 4. Navigation

Le menu est filtré par `src/lib/nav.ts`. Une URL hors rôle affiche `/403`. Le sélecteur d'année, le menu, puis le contenu suivent dans l'ordre de tabulation. Sous 1024 px le menu est un tiroir. La saisie sous 768 px reste utilisable, avec le bandeau prévu par la spec UX.

## 5. Hors de ce lot

Les Route Handlers, Auth.js et le middleware sont écrits par l'agent backend. Tant qu'ils ne répondent pas, les écrans montrent l'état d'erreur et le bouton Réessayer, jamais un jeu de données en dur.

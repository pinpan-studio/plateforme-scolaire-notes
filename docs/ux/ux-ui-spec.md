# Spécification UX / UI — Plateforme scolaire de notes

Document de référence pour l’expérience et l’interface de l’application web de **saisie, gestion, consultation et analyse des notes**. Il décrit ce que l’utilisateur voit et fait. Il ne prescrit pas le code.

Langue de l’interface : **français**. Public : personnel d’un établissement du second degré francophone (collège de démonstration : niveaux 6e à 3e, trois trimestres, notes sur 20).

## 1. Objet et périmètre

L’application permet de :

- structurer un établissement (année, classes, élèves, enseignants, matières, affectations, périodes) ;
- créer des évaluations et saisir les notes ;
- calculer moyennes, rangs et appréciations ;
- consulter bulletins et statistiques.

Ce document couvre les écrans, les parcours, les composants d’interface, les règles d’affichage liées aux droits, et les critères d’acceptation UX.

Hors de ce document : schéma de base, API, déploiement, plan de tests, checklist de sécurité. Ces sujets vivent dans leurs propres documents. L’interface doit toutefois rendre visibles les règles métier qu’ils protègent (droits, validations, notes absentes, plafonds).

## 2. Décisions clés

| Sujet | Décision |
| --- | --- |
| Cible | Collège francophone, une année active à la fois, trimestres 1, 2 et 3, barème sur 20 |
| Densité | Interface d’administration sobre ; la saisie des notes passe en densité compacte |
| Navigation | Menu latéral filtré par rôle ; l’année scolaire active est un sélecteur global |
| Saisie | Une évaluation à la fois, grille élèves × note, pilotable au clavier |
| Note absente | Case « Absent » : pas de valeur chiffrée, exclue des moyennes, affichée « Abs. » |
| Rang | Ex æquo de type compétition : 1, 2, 2, 4 |
| Appréciation | Barème unique documenté au § 10, calculé, non saisi librement sauf l’appréciation littérale du professeur principal |
| Actions interdites | Masquées dans l’interface ; une URL directe non autorisée affiche la page 403 |
| Enseignant | Ne voit et ne modifie que les évaluations et notes de ses affectations (classe + matière + année) |
| Professeur principal | Droits enseignant, plus la synthèse et l’appréciation générale de sa classe |
| Direction | Pilotage et structure pédagogique, consultation de toutes les notes, pas de gestion des comptes, pas d’écrasement d’une note |
| Consultation | Lecture seule des résultats, bulletins et statistiques |
| Admin | Tout, y compris l’établissement et les comptes |
| Périmètre volontairement absent | Module d’absences global, import de fichiers, messagerie, emploi du temps, notes de comportement séparées |
| Appareils | Bureau prioritaire pour la saisie ; tablette et mobile pour la consultation |
| Accessibilité | Cible WCAG 2.2 niveau AA |
| Identité visuelle | Tailwind, fond clair, bleu institutionnel, pas d’illustration décorative sur les écrans de travail |

## 3. Principes d’expérience

1. **Le travail courant tient en peu de clics.** Saisir une évaluation déjà créée ne demande pas de reconfigurer la classe ou la période.
2. **L’état est toujours lisible.** Année active, période, rôle et enregistrement (brouillon / enregistré / erreur) restent visibles.
3. **Les chiffres se vérifient.** Chaque moyenne affiche, au survol ou dans un panneau, les notes et coefficients qui la composent.
4. **L’erreur bloque tôt et dit quoi corriger.** Le message cite le champ, la règle et la valeur attendue. Pas de code technique.
5. **On ne propose pas une action interdite.** Un bouton absent vaut mieux qu’un bouton désactivé sans explication, sauf quand l’utilisateur doit comprendre pourquoi (note verrouillée, hors affectation).
6. **La grille de notes se comporte comme un tableur court**, pas comme un formulaire d’une ligne par élève sur toute la hauteur de la page.
7. **Rien ne se perd sans avertissement.** Quitter une saisie non enregistrée demande confirmation.

## 4. Utilisateurs et droits visibles

| Rôle | Intention principale | Ce que l’interface lui montre |
| --- | --- | --- |
| ADMIN | Tenir l’établissement et les comptes | Tous les menus, y compris Établissement et Utilisateurs |
| DIRECTION | Organiser l’année et suivre les résultats | Structure pédagogique, évaluations en lecture, bulletins, statistiques. Pas de menu Utilisateurs |
| ENSEIGNANT | Évaluer ses classes | Tableau de bord personnel, évaluations et saisie limitées à ses affectations, listes d’élèves de ces classes (identité utile à l’appel de note : matricule, nom, prénom) |
| PROFESSEUR_PRINCIPAL | Tenir sa classe et le bulletin | Comme l’enseignant, plus Synthèse de classe et appréciation générale |
| CONSULTATION | Lire les résultats | Tableaux, bulletins et graphiques sans aucun bouton de création ou de modification |

Règle d’écran pour l’enseignant et le professeur principal : une classe ou une matière non affectée n’apparaît pas dans les filtres de saisie. Si l’adresse est forcée, la page 403 indique : « Cette classe ou cette matière ne vous est pas affectée. »

Le professeur principal qui enseigne aussi une matière conserve les deux casquettes : saisie de ses notes, et synthèse en lecture seule des autres matières de sa classe.

## 5. Architecture de l’information

Sélecteur global, toujours visible une fois connecté : **année scolaire active**. Changer d’année recharge les listes (classes, évaluations, statistiques) sans mélanger les données.

```text
Connexion
└─ Application
   ├─ Tableau de bord
   ├─ Scolarité
   │  ├─ Années scolaires          (admin, direction)
   │  ├─ Classes
   │  ├─ Élèves
   │  ├─ Enseignants               (admin, direction ; fiche limitée pour les autres)
   │  └─ Matières et coefficients  (admin, direction)
   ├─ Organisation
   │  ├─ Affectations              (admin, direction)
   │  ├─ Périodes                  (admin, direction)
   │  └─ Établissement             (admin)
   ├─ Notes
   │  ├─ Évaluations
   │  ├─ Saisie des notes
   │  └─ Synthèse de classe        (professeur principal, direction, admin, consultation)
   ├─ Résultats
   │  ├─ Bulletins
   │  └─ Statistiques
   └─ Compte
      ├─ Mon profil
      └─ Utilisateurs              (admin)
```

Libellés de menu courts, en français, sans icône seule : l’icône accompagne le texte.

## 6. Parcours prioritaires

Le parcours de référence, du vide jusqu’aux statistiques, suit cette chaîne. Chaque étape a un écran dédié et un lien « étape suivante » contextuel une fois l’enregistrement réussi.

1. Choisir ou créer l’année scolaire et la marquer active.
2. Créer une classe (nom, niveau, année).
3. Inscrire les élèves (objectif de démonstration : une classe d’environ 30 élèves, ajout un par un, avec liste immédiatement à jour).
4. Créer les matières (code, nom, coefficient, niveau).
5. Créer l’enseignant.
6. L’affecter à une classe et une matière pour l’année.
7. Créer une évaluation (matière, classe, enseignant affecté, période, type, date, note maximale, coefficient).
8. Saisir les notes de la classe, y compris des absents.
9. Lire la moyenne de matière et la moyenne générale.
10. Lire le classement, ex æquo compris.
11. Lire les statistiques de la classe et de l’évaluation.

Parcours quotidien de l’enseignant : connexion → tableau de bord « évaluations à saisir » → grille → enregistrement → retour au tableau de bord avec le compteur mis à jour.

Parcours bulletin : direction ou professeur principal ouvre Bulletins, choisit classe et trimestre, contrôle les moyennes, le professeur principal rédige l’appréciation générale, puis impression A4.

## 7. Inventaire des écrans

| Écran | Route suggérée | Rôles en écriture | Rôles en lecture |
| --- | --- | --- | --- |
| Connexion | `/connexion` | tout visiteur | — |
| Tableau de bord | `/` | — | tous les rôles connectés |
| Établissement | `/etablissement` | admin | admin |
| Années scolaires | `/annees` | admin, direction | admin, direction |
| Classes | `/classes` | admin, direction | tous (filtrées pour l’enseignant) |
| Fiche classe | `/classes/[id]` | admin, direction | selon rôle |
| Élèves | `/eleves` | admin, direction | enseignant et PP : élèves de leurs classes |
| Fiche élève | `/eleves/[id]` | admin, direction | PP de la classe, direction, admin ; enseignant : identité restreinte |
| Enseignants | `/enseignants` | admin, direction | admin, direction |
| Matières | `/matieres` | admin, direction | tous en lecture sur les matières qui les concernent |
| Affectations | `/affectations` | admin, direction | enseignant : les siennes |
| Périodes | `/periodes` | admin, direction | tous |
| Évaluations | `/evaluations` | enseignant sur ses affectations ; admin | direction, consultation, PP en lecture |
| Saisie des notes | `/evaluations/[id]/notes` | enseignant affecté, admin | direction, consultation, PP |
| Synthèse de classe | `/classes/[id]/synthese` | appréciation générale : PP | direction, admin, consultation, PP |
| Bulletins | `/bulletins` | appréciation générale : PP | direction, admin, consultation, PP, enseignant (ses matières seules) |
| Statistiques | `/statistiques` | — | tous, données bornées par le rôle |
| Utilisateurs | `/utilisateurs` | admin | admin |
| Mon profil | `/profil` | soi-même (mot de passe, téléphone affiché) | soi-même |
| 403 | `/403` | — | tous |
| 404 | toute route inconnue | — | tous |

Pas d’écran « absences » séparé : l’absence se traite dans la grille de notes.

## 8. Spécification des écrans

### 8.1 Connexion

Page centrée, largeur étroite, nom de l’établissement, titre « Connexion », champs E-mail et Mot de passe, bouton « Se connecter ».

- Erreur d’identifiants : « E-mail ou mot de passe incorrect. » Le message ne dit pas lequel des deux est faux.
- Compte désactivé : « Ce compte est désactivé. Contactez l’administration. »
- Après succès : redirection vers le tableau de bord du rôle.
- Pas d’auto-inscription, pas de « se souvenir de moi » affiché comme case cochée par défaut. Lien « Mot de passe oublié » absent de cette version : la réinitialisation se fait par l’administrateur.

### 8.2 Tableau de bord

En-tête : « Bonjour {prénom} », rôle lisible (« Enseignant »), année active.

Blocs selon le rôle, dans cet ordre :

- **Enseignant** : cartes « Évaluations sans notes complètes », liste des affectations, dernier enregistrement.
- **Professeur principal** : les mêmes cartes, plus « Appréciations de bulletin manquantes » pour sa classe.
- **Direction** : effectif, nombre de classes, moyenne générale de l’établissement sur la période en cours, trois classes les plus en difficulté (moyenne la plus basse), lien Statistiques.
- **Admin** : raccourcis Établissement, Année active, Utilisateurs, et l’alerte si aucun utilisateur n’a le rôle Direction.
- **Consultation** : mêmes indicateurs que la direction, sans lien d’édition.

Chaque carte a un chiffre, un libellé et un seul lien d’action.

### 8.3 Listes de structure (années, classes, élèves, enseignants, matières, affectations, périodes, évaluations)

Même squelette :

1. Titre de page et bouton primaire « Ajouter… » si le rôle écrit.
2. Barre d’outils : recherche textuelle, filtres, compteur de résultats (« 32 élèves »).
3. Tableau.
4. Pagination en bas si plus de 25 lignes. La saisie des notes n’est pas paginée (voir § 9).

Colonnes minimales :

| Liste | Colonnes |
| --- | --- |
| Années | Libellé, début, fin, statut (Brouillon, Active, Clôturée) |
| Classes | Nom, niveau, effectif, professeur principal, année |
| Élèves | Matricule, nom, prénom, classe, statut |
| Enseignants | Nom, prénom, e-mail, téléphone, statut |
| Matières | Code, nom, coefficient, niveau |
| Affectations | Enseignant, classe, matière, année |
| Périodes | Libellé (Trimestre 1, 2, 3), année, dates |
| Évaluations | Date, type, matière, classe, période, note max, coefficient, avancement des notes (« 28/30 ») |

Actions de ligne : « Ouvrir ». « Modifier » et « Supprimer » seulement si le rôle écrit et si la suppression est encore permise (une évaluation qui a des notes ne se supprime pas : le bouton est absent, un texte dans la fiche explique « Retirez les notes avant de supprimer l’évaluation »).

### 8.4 Fiches et formulaires

Panneau ou page dédiée, pas une modale pour les fiches longues (élève, évaluation). Les créations courtes (période, matière) peuvent s’ouvrir dans un panneau latéral.

Champs et règles visibles :

- **Année** : libellé, date de début, date de fin. La fin est postérieure au début. Une seule année « Active ». Clôturer demande une confirmation : les saisies de cette année deviennent en lecture seule.
- **Classe** : nom, niveau, année, professeur principal optionnel (liste d’enseignants).
- **Élève** : matricule unique, nom, prénom, date de naissance, sexe (Féminin, Masculin, Non renseigné), classe de l’année active, statut (Inscrit, Radié). Le matricule est en capitales, sans espace imposé au-delà du trim.
- **Enseignant** : nom, prénom, e-mail unique, téléphone, statut (Actif, Inactif).
- **Matière** : code unique, nom, coefficient strictement positif, niveau.
- **Affectation** : enseignant, classe, matière, année. Le doublon de ce trio est refusé avec le message « Cette affectation existe déjà. »
- **Évaluation** : matière, classe, enseignant (liste limitée aux enseignants affectés à ce couple classe/matière), période, type (Devoir, Contrôle, Composition, Oral), date, note maximale > 0, coefficient > 0. Valeur par défaut proposée : note maximale 20, coefficient 1.
- **Utilisateur** : e-mail, rôle, lien optionnel vers un enseignant (obligatoire pour les rôles Enseignant et Professeur principal), mot de passe initial affiché une seule fois après création, statut.

Le bouton primaire s’appelle « Enregistrer ». Annuler revient à la liste sans écrire.

### 8.5 Fiche élève

Deux colonnes sur grand écran.

- Identité et inscription.
- Résultats de l’année active : moyenne générale, rang, puis tableau matière / moyenne / appréciation.

L’enseignant de matière ne voit pas la date de naissance ni le téléphone des responsables (ces données ne sont de toute façon pas au périmètre). Il voit nom, prénom, matricule, classe, et les notes des évaluations qu’il a créées.

### 8.6 Bulletins

Sélecteurs : classe, période. Tableau des élèves. Ouvrir un bulletin affiche :

- en-tête établissement, élève, classe, période ;
- lignes de matières : moyenne, coefficient, appréciation de matière (calculée), rang dans la matière ;
- moyenne générale, rang de classe, effectif ;
- zone « Appréciation générale » éditable par le professeur principal de la classe tant que la période n’est pas clôturée ;
- bouton « Imprimer » qui ouvre la vue A4.

L’enseignant simple voit le bulletin réduit à ses matières, sans l’appréciation générale des autres.

### 8.7 Statistiques

Filtres en tête : période, classe, matière. Quatre vues, dans cet ordre :

1. Distribution des moyennes générales (histogramme par tranches du barème d’appréciation).
2. Moyenne par matière pour la classe choisie (barres).
3. Évolution des moyennes de classe d’un trimestre à l’autre si au moins deux périodes ont des notes.
4. Liste des élèves sous 10/20, avec effectif.

Le survol d’une barre donne la valeur exacte et l’effectif. Les graphiques ont un équivalent tableau juste en dessous, replié par défaut sous « Voir les données ». La consultation et la direction voient l’ensemble ; l’enseignant voit ses matières ; le professeur principal voit sa classe en entier.

### 8.8 Mon profil et utilisateurs

Profil : nom affiché, e-mail en lecture seule, changement de mot de passe (actuel, nouveau, confirmation). L’admin crée les comptes et peut désactiver un compte. Il ne voit jamais le mot de passe après la création : seulement « Définir un nouveau mot de passe temporaire ».

## 9. Saisie des notes

C’est l’écran critique. Il s’ouvre depuis une évaluation, jamais comme une grille géante de toutes les évaluations.

### 9.1 En-tête

- Fil d’Ariane : Évaluations / {classe} / {matière} / {type} du {date}.
- Rappel : période, note maximale, coefficient, enseignant.
- Compteurs : saisies, absents, restantes.
- Boutons : « Enregistrer » (primaire), « Annuler les modifications ».

Si l’utilisateur n’a pas le droit d’écrire, le même écran s’affiche en lecture seule, sans champs éditables, avec le bandeau « Consultation seule ».

### 9.2 Grille

Colonnes : Matricule, Nom et prénom, Note, Absent, Commentaire (optionnel, une ligne).

- Tri initial : nom puis prénom.
- Recherche locale sur le nom et le matricule, sans recharger la page.
- Toutes les lignes de la classe sont visibles (défilement de page). Pas de pagination qui cacherait un élève non saisi.
- La note accepte une virgule ou un point, affichés ensuite avec une virgule et au plus deux décimales.
- La case Absent vide le champ Note et le désactive. Décocher rend le champ à nouveau éditable.
- Une note vide sans case Absent compte comme « restante », pas comme zéro.
- Commentaire : 200 caractères, compteur discret.

### 9.3 Clavier

- Entrée ou Flèche bas : ligne suivante, même colonne.
- Flèche haut : ligne précédente.
- La case Absent se coche avec Espace quand elle a le focus.
- Le focus visible est une bordure forte, pas seulement un changement de couleur de fond.

### 9.4 Validation immédiate

| Situation | Comportement |
| --- | --- |
| Note &lt; 0 | Champ en erreur, « La note ne peut pas être négative. » |
| Note &gt; note maximale | « La note ne peut pas dépasser {max}. » |
| Texte non numérique | « Indiquez une note ou cochez Absent. » |
| Absent coché | aucune erreur de note |
| Doublon élève / évaluation | impossible à produire dans la grille (une ligne par élève) ; si l’API le signale, bannière « Cette note existe déjà. Rechargez la page. » |

« Enregistrer » est bloqué tant qu’une ligne est en erreur. Les lignes valides ne sont pas perdues : le message précise « Corrigez les lignes signalées avant d’enregistrer. »

### 9.5 Enregistrement

- L’enregistrement est explicite. Pas d’envoi à chaque frappe.
- Pendant l’envoi : bouton en attente « Enregistrement… », grille non éditable.
- Succès : bannière « Notes enregistrées. » et compteurs à jour.
- Échec réseau : « L’enregistrement a échoué. Vos saisies sont encore sur cette page. Réessayez. »
- Fermeture ou navigation avec des modifications locales : dialogue « Quitter sans enregistrer ? » avec « Rester » (primaire) et « Quitter ».

Une année ou une période clôturée rend la grille en lecture seule pour tout le monde, y compris l’admin, avec le texte « Période clôturée. Les notes ne sont plus modifiables. »

## 10. Calculs, rangs et appréciations affichés

Les formules sont celles du module de calcul unique. L’interface ne les réinvente pas. Elle les rend vérifiables.

### 10.1 Moyenne de matière

Moyenne pondérée par les coefficients d’évaluation, après ramener chaque note sur 20 :

`note sur 20 = valeur / note_max × 20`

Puis :

`moyenne = Σ (note_sur_20 × coefficient_évaluation) / Σ coefficients`

Les évaluations marquées Absentes sont ignorées (ni au numérateur, ni au dénominateur). Une matière sans aucune note chiffrée affiche « — » et n’entre pas dans la moyenne générale.

Exemple affiché dans l’aide contextuelle « Comment est calculée la moyenne ? » :

Deux évaluations, 15/20 coefficient 4 et 12/20 coefficient 2 :

`(15 × 4 + 12 × 2) / (4 + 2) = 14`

### 10.2 Moyenne générale

Même principe avec les coefficients de matières. Une matière sans note est absente du calcul, et un indicateur le signale : « 2 matières sans note, non comptées. »

### 10.3 Rang

Rang de compétition, du meilleur au moins bon. Deux moyennes égales partagent le rang ; le suivant saute le ou les rangs occupés (1, 2, 2, 4). L’égalité se juge sur la moyenne affichée à deux décimales. Le rang montre l’effectif : « 2e / 30 ».

### 10.4 Appréciation

Calculée sur la moyenne sur 20, seuils inclusifs vers le haut :

| Moyenne | Appréciation |
| --- | --- |
| ≥ 16 | Très bien |
| ≥ 14 et &lt; 16 | Bien |
| ≥ 12 et &lt; 14 | Assez bien |
| ≥ 10 et &lt; 12 | Passable |
| ≥ 8 et &lt; 10 | Insuffisant |
| &lt; 8 | Très insuffisant |
| aucune note | Non évalué |

L’appréciation de matière est en lecture seule. L’appréciation générale du bulletin est un texte libre du professeur principal, prérempli vide, distinct du libellé calculé de la moyenne générale (les deux apparaissent).

### 10.5 Présentation des nombres

- Affichage français : virgule décimale, deux décimales pour les moyennes (`14,00`).
- La note saisie `14,5` s’affiche `14,50` après enregistrement.
- Le coefficient s’affiche sans décimale inutile (`4` ou `1,5`).

## 11. Formulaires, tableaux, recherche et filtres

### 11.1 Formulaires

- Label au-dessus du champ, toujours visible (pas de placeholder à la place du label).
- Champ obligatoire : astérisque dans le label et mention « Champs obligatoires » en tête de formulaire.
- Erreur sous le champ, liée à lui pour les technologies d’assistance, plus un résumé en tête si plusieurs erreurs au moment d’enregistrer.
- Champ désactivé : fond grisé et explication à côté (« Réservé à l’administration » ou « Période clôturée »).

### 11.2 Tableaux

- En-tête de colonne fixé au défilement vertical sur les listes longues.
- Colonne triable : bouton dans l’en-tête, annonce « tri croissant » ou « tri décroissant ».
- Ligne cliquable entière vers la fiche, avec un lien texte « Ouvrir » pour l’accessibilité.
- Zèbre léger ou séparateurs, pas les deux en fort contraste.
- État vide : illustration absente, phrase de situation et bouton d’action s’il existe. Exemple : « Aucun élève dans cette classe. Ajoutez le premier élève. »

### 11.3 Recherche

- Champ « Rechercher », placé au-dessus du tableau.
- Recherche locale dès 3 listes de référence : élèves (nom, prénom, matricule), enseignants (nom, e-mail), évaluations (matière, classe).
- La recherche ne remet pas la page à zéro de façon silencieuse : le compteur devient « 4 résultats pour “dupont” ».
- Effacer la recherche est un bouton dans le champ.

### 11.4 Filtres

- Filtres explicites, jamais seulement dans une recherche libre : année (déjà globale), niveau, classe, période, matière, statut.
- Les filtres choisis s’affichent en pastilles supprimables « Classe : 6e A ».
- « Réinitialiser les filtres » apparaît dès qu’un filtre local est actif.
- Combinaison sans résultat : « Aucun résultat. Modifiez ou réinitialisez les filtres. »

## 12. Design system

Réalisable avec Tailwind, sans librairie visuelle imposée. Composants cohérents plutôt que pages isolées.

### 12.1 Couleur

| Jeton | Usage | Valeur indicative |
| --- | --- | --- |
| `primary` | Actions principales, liens, année active | bleu `#1d4ed8` |
| `surface` | Fond de page | gris `#f8fafc` |
| `card` | Cartes et formulaires | blanc `#ffffff` |
| `ink` | Texte | ardoise `#0f172a` |
| `muted` | Texte secondaire | `#475569` |
| `border` | Filets | `#e2e8f0` |
| `success` | Enregistrement réussi | `#15803d` |
| `warning` | Brouillon, période bientôt clôturée | `#a16207` |
| `danger` | Erreur, suppression | `#b91c1c` |

Le statut d’une note ou d’une appréciation ne repose jamais sur la seule couleur : texte (« Abs. », « Très bien ») toujours présent. Contraste texte courant au moins 4,5:1, texte large et composants au moins 3:1.

### 12.2 Typographie et espacement

- Police système ou Inter, taille de base 16 px.
- Titre de page 1,5 rem, semi-gras.
- Titres de section 1,125 rem.
- Rayon des cartes 8 px, ombre très légère.
- Espacement vertical des blocs : 24 px.
- Grille de notes : 14 px, hauteur de ligne 36 px, pour tenir une classe de 30 élèves à l’écran avec le moins de défilement possible sur un portable 1366×768.

### 12.3 Composants

- Bouton primaire, bouton secondaire, bouton danger texte (suppression).
- Champ texte, liste déroulante native, case à cocher, zone de texte courte.
- Bannière succès, avertissement, erreur, information. Une seule bannière de statut à la fois en haut du contenu.
- Pastille de statut : Active, Clôturée, Inscrit, Absent, Non évalué.
- Dialogue de confirmation à deux actions, le focus piégé dedans, Échap = annuler.
- Menu latéral repliable en icônes + texte ; en dessous de 1024 px il devient un tiroir.

### 12.4 Ton

Phrases courtes, vouvoiement absent : l’interface tutoie le métier, pas la personne. Forme impersonnelle ou infinitif : « Enregistrer », « Ajouter un élève », « La note ne peut pas être négative. » Pas d’emoji, pas de point d’exclamation.

## 13. États transverses

| État | Rendu |
| --- | --- |
| Chargement initial | Squelette de la zone de contenu, le menu reste utilisable |
| Chargement &lt; 300 ms | pas de flash de squelette |
| Liste vide | message + action |
| Erreur de chargement | « Impossible de charger les données. » et bouton « Réessayer » |
| Succès d’enregistrement | bannière verte, disparaît au changement de page, reste visible au moins le temps de la lire |
| Session expirée | redirection connexion avec « Votre session a expiré. Reconnectez-vous. » ; la saisie de notes non envoyée ne peut pas être garantie, le dialogue de départ s’affiche si des modifications sont encore en mémoire |
| 403 | titre « Accès refusé », phrase adaptée (rôle ou affectation), lien « Retour au tableau de bord » |
| 404 | « Cette page n’existe pas. » et lien tableau de bord |

## 14. Accessibilité

Cible WCAG 2.2 AA.

- Chaque champ a un label. Les erreurs sont reliées au champ.
- Ordre de tabulation : sélecteur d’année, menu, contenu, de haut en bas.
- Focus visible sur tous les contrôles interactifs.
- Le menu, les dialogues et les bannières d’erreur utilisent les rôles adaptés (`navigation`, `dialog`, `alert`).
- Les tableaux de données ont des en-têtes de colonnes. La grille de notes annonce la ligne (nom de l’élève) lorsque le focus entre dans la note.
- Les graphiques ne sont pas la seule source : tableau de données associé.
- Zoom 200 % utilisable sur le tableau de bord, les formulaires et la grille (défilement horizontal accepté sur la grille).
- Contraste conforme au § 12.1. Le mouvement n’est pas nécessaire à la compréhension.

## 15. Responsive et impression

| Largeur | Comportement |
| --- | --- |
| ≥ 1280 px | Menu ouvert, contenu large, grille de notes confortable |
| 1024–1279 px | Menu ouvert étroit, tableaux en défilement horizontal si besoin |
| &lt; 1024 px | Menu en tiroir, cartes du tableau de bord empilées, listes en cartes si le tableau ne tient pas |
| &lt; 768 px | Consultation, bulletins et statistiques utilisables. La saisie affiche un bandeau : « La saisie des notes est prévue pour un écran plus large. » La grille reste accessible en défilement horizontal, elle n’est pas bloquée |

Impression limitée au bulletin : format A4 portrait, marges 12 mm, couleurs d’appréciation converties en texte noir, boutons et menu absents, nom de l’établissement en tête, pagination « Page n » si le bulletin déborde.

## 16. Messages types

| Situation | Message |
| --- | --- |
| Matricule déjà utilisé | « Ce matricule est déjà attribué à un élève. » |
| Note négative | « La note ne peut pas être négative. » |
| Note au-dessus du maximum | « La note ne peut pas dépasser {max}. » |
| Coefficient ou note max invalide | « Indiquez un nombre supérieur à 0. » |
| Dates incohérentes | « La date de fin doit être postérieure à la date de début. » |
| Affectation en double | « Cette affectation existe déjà. » |
| Enseignant non affecté à l’évaluation | « Choisissez un enseignant affecté à cette classe et cette matière. » |
| Suppression impossible | « Des notes sont déjà saisies. La suppression est impossible. » |
| Période clôturée | « Période clôturée. Les notes ne sont plus modifiables. » |
| Hors affectation | « Cette classe ou cette matière ne vous est pas affectée. » |
| Enregistrement réussi | « Notes enregistrées. » |

## 17. Hors périmètre de l’interface

Ces éléments ne doivent pas apparaître comme des menus, boutons ou promesses d’écran :

- cahier d’absences et de retards ;
- import ou export tableur (l’impression du bulletin suffit) ;
- messagerie familles et espace parent ou élève ;
- emploi du temps ;
- personnalisation de thème (clair uniquement) ;
- plusieurs établissements dans la même session (une fiche établissement, pas un sélecteur multi-écoles).

## 18. Critères d’acceptation UX

1. Un enseignant connecté ne voit, dans les filtres de saisie, que ses classes et matières affectées.
2. La grille présente une ligne par élève de la classe, sans pagination.
3. Cocher Absent efface la note, l’exclut des compteurs de moyenne et affiche « Abs. » en lecture.
4. Une note négative ou supérieure au maximum empêche l’enregistrement et nomme la règle.
5. L’aide de moyenne montre l’exemple `(15 × 4 + 12 × 2) / (4 + 2) = 14`.
6. Deux moyennes identiques affichent le même rang, et le suivant est sauté.
7. L’appréciation affichée correspond au barème du § 10.4.
8. Le professeur principal peut saisir l’appréciation générale ; un enseignant d’une autre matière ne le peut pas.
9. La direction consulte toutes les classes ; elle ne voit pas le menu Utilisateurs et ne modifie pas une note.
10. Le rôle Consultation n’a aucun bouton Ajouter, Enregistrer ou Supprimer.
11. Quitter la grille avec des modifications non enregistrées demande confirmation.
12. Le bulletin imprimé tient les informations du § 8.6 sans le chrome de l’application.
13. Les écrans du § 7 existent dans la navigation selon le rôle, en français, avec un état vide explicite.

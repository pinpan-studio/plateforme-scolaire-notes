# Calcul des notes

Module TypeScript pur (`src/lib/grading`). Il ne dépend ni de React, ni de PostgreSQL, ni d'un framework : le backend et le frontend importent les mêmes fonctions.

```ts
import {
  computePeriodReport,
  appreciate,
  rankCompetition,
  computeStatistics,
  compareTerms,
} from './src/lib/grading';
```

## Formules

### Note ramenée sur 20

Chaque note présente est normalisée avant toute pondération :

```text
note20 = (score / noteMax) × 20
```

`15/30` devient `10`. `8/10` devient `16`. La précision de cette division est conservée jusqu'à l'arrondi de la moyenne de matière.

### Moyenne de matière

Pondération par les coefficients d'évaluation. Les absences ne figurent ni au numérateur ni au dénominateur.

```text
brute = Σ(note20 × coefÉvaluation) / Σ(coefÉvaluation)
publiée = arrondi(brute)
```

Seul `absent: true` exclut une note. Un zéro saisi est un vrai zéro.

### Moyenne générale

La pondération part des **moyennes de matière déjà arrondies au centième**, puis le résultat est arrondi à son tour.

```text
brute = Σ(moyenneMatièreArrondie × coefMatière) / Σ(coefMatière)
publiée = arrondi(brute)
```

Exemple imposé : `(15×4 + 12×2) / (4+2) = 14,00`.

Une matière sans note comptable est exclue. Elle n'est pas remplacée par 0. `computePeriodReport` enchaîne les deux étapes dans cet ordre.

## Arrondi unique

Une seule fonction, `roundToCent`, et une seule règle, exportée par `ROUNDING_MODE` :

| Constante | Valeur |
| --- | --- |
| `GRADE_DECIMALS` | `2` |
| `ROUNDING_MODE` | `half-away-from-zero` |
| `GRADE_SCALE` | `20` |
| `PASS_MARK` | `10` |

Au centième le plus proche, le chiffre 5 s'éloigne de zéro. Pour une note positive, `14,005` devient `14,01` et `14,004` devient `14,00`.

`Math.round(x * 100) / 100` n'est pas utilisé : en binaire, `1.005 * 100` vaut `100.49999999999999` et retomberait à `1,00`. L'implémentation stabilise le produit avant d'appliquer la règle.

Où l'arrondi intervient :

| Étape | Moment |
| --- | --- |
| Moyenne de matière | une fois, sur le résultat |
| Moyenne générale | sur chaque moyenne de matière, puis sur le résultat |
| Mention, réussite, tranches, rang, écart de trimestre | sur la valeur publiée |

`publishOnScale` arrondit puis refuse le centième s'il sort de `[0, 20]`. `20,004` est publié `20,00`. `20,005` devient `20,01` et est refusé.

## Barème d'appréciation

Constante unique : `APPRECIATION_SCALE`. La mention est la première tranche dont le seuil inclusif est atteint par la moyenne publiée. Les bornes hautes sont dérivées (`listAppreciationBands`), jamais redéfinies.

| Code | Mention | Moyenne publiée |
| --- | --- | --- |
| `tres_bien` | Très bien | 16,00 à 20,00 inclus |
| `bien` | Bien | 14,00 inclus à 16,00 exclu |
| `assez_bien` | Assez bien | 12,00 inclus à 14,00 exclu |
| `passable` | Passable | 10,00 inclus à 12,00 exclu |
| `insuffisant` | Insuffisant | 8,00 inclus à 10,00 exclu |
| `tres_insuffisant` | Très insuffisant | 0,00 inclus à 8,00 exclu |

Très bien commence à 16/20. Très insuffisant est strictement sous 8 : `8,00` est « Insuffisant ». Les seuils 14, 12 et 10 sont le barème classique des bulletins ; la consigne ne fixait que les deux extrémités.

`15,995` s'affiche `16,00` et obtient « Très bien ». `7,995` s'affiche `8,00` et obtient « Insuffisant ».

## Classement

`rankCompetition` produit un rang de compétition : `1, 2, 2, 4`. Le meilleur score est le plus haut. Deux scores qui s'affichent au même centième sont ex æquo et gardent l'ordre d'entrée. Le rang suivant est sauté. Un score `null` n'est pas classé et n'est pas traité comme un 0.

## Statistiques

`computeStatistics` s'applique à une série déjà exprimée sur 20. Une série vide donne `null`.

Chaque valeur est publiée au centième avant les calculs, pour que les indicateurs collent au bulletin.

- **Moyenne** : moyenne arithmétique des valeurs publiées, puis arrondi.
- **Min / max** : minimum et maximum publiés.
- **Médiane** : valeur centrale, ou moyenne des deux valeurs centrales si l'effectif est pair, puis arrondi.
- **Taux de réussite** : part des valeurs publiées `≥ 10`. `passRate` est la part exacte, `passRatePercent` est cette part × 100, arrondie au centième.
- **Distribution** : les six tranches de `APPRECIATION_SCALE`, dans le même ordre, y compris les tranches à 0.

## Comparaison de trimestres

`compareTerms` suit l'ordre du tableau (T1, puis T2, puis T3). L'écart est la différence des moyennes publiées, calculée en centièmes entiers.

| `trend` | Sens |
| --- | --- |
| `up` | écart &gt; 0 |
| `down` | écart &lt; 0 |
| `stable` | écart = 0 |
| `incomplete` | au moins une moyenne absente |

`fromFirstToLast` relie le premier trimestre au dernier. `highest` et `lowest` ignorent les trimestres sans moyenne ; en cas d'égalité, le plus ancien l'emporte.

## Cas limites

| Situation | Résultat |
| --- | --- |
| Aucune note, ou seulement des absences | `value: null`, jamais 0 |
| Matière sans moyenne dans la générale | exclue, jamais comptée 0 |
| Coefficient `≤ 0` ou non fini | `GradingError` `COEFFICIENT_NOT_POSITIVE` ou `NON_FINITE` |
| Note &gt; barème | `SCORE_ABOVE_MAX` |
| Note négative | `SCORE_NEGATIVE` |
| Barème d'évaluation `≤ 0` | `MAX_SCORE_NOT_POSITIVE` |
| Valeur non finie | `NON_FINITE` |
| Centième publié hors de `[0, 20]` | `VALUE_OUT_OF_SCALE` |
| Identifiant vide ou doublon (matière, trimestre) | `EMPTY_ID`, `DUPLICATE_ID` |

Une donnée refusée interrompt le calcul. Elle n'est pas ignorée ni remplacée par 0. Les champs d'une absence ne sont pas validés : la note ne compte pas.

## Exemples

### Moyenne de matière avec absence et barèmes différents

| Évaluation | Note | Coefficient | Retenu |
| --- | --- | --- | --- |
| Devoir | 12/20 | 1 | 12 |
| Contrôle | absent | 3 | exclu |
| Oral | 8/10 | 2 | 16 |

```text
(12×1 + 16×2) / (1+2) = 14,666… → 14,67
```

### Moyenne générale

| Matière | Moyenne publiée | Coefficient |
| --- | --- | --- |
| Mathématiques | 15,00 | 4 |
| Français | 12,00 | 2 |

```text
(15×4 + 12×2) / (4+2) = 14,00
```

Mention : Bien. Si une troisième matière, coefficient 3, n'a aucune note, la générale reste `14,00`.

### Classement

Scores publiés `18`, `15`, `15`, `10` → rangs `1`, `2`, `2`, `4`.

### Statistiques de classe

Série `8, 10, 12, 16, 18` :

| Indicateur | Valeur |
| --- | --- |
| Moyenne | 12,80 |
| Min / max | 8 / 18 |
| Médiane | 12 |
| Réussite | 4/5 = 80 % |
| Très bien | 2 |
| Assez bien | 1 |
| Passable | 1 |
| Insuffisant | 1 |

`8,00` est insuffisant, pas très insuffisant. `10,00` est une réussite.

### Trimestres

`T1 = 12,05`, `T2 = 14,20`, `T3 = 14,20` :

- T1 → T2 : `+2,15`, hausse
- T2 → T3 : `0,00`, stable
- T1 → T3 : `+2,15`, hausse

## Lancer les tests

La config est locale pour ne pas dépendre d'un script npm :

```bash
npx vitest run --config src/lib/grading/vitest.config.ts
```

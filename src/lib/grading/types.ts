/** Note d'une évaluation. Seul `absent: true` exclut la note (jamais remplacée par 0). */
export type GradeInput = {
  /** Note brute. Ignorée lorsque `absent` vaut `true`. */
  score: number;
  /** Barème de l'évaluation (10, 20, 40, 100…). Doit être > 0 si la note est présente. */
  maxScore: number;
  /** Poids de l'évaluation dans la matière. Doit être > 0 si la note est présente. */
  coefficient: number;
  /**
   * Absence. Seul le booléen `true` exclut la note.
   * Un zéro avec `absent` absent ou `false` compte comme un zéro.
   */
  absent?: boolean;
};

/** Résultat d'une moyenne. `value` est `null` quand aucune donnée n'est comptée. */
export type AverageResult = {
  /** Moyenne publiée, arrondie au centième. `null` s'il n'y a rien à compter. */
  value: number | null;
  /** Moyenne exacte avant l'arrondi final. */
  raw: number | null;
  /** Nombre d'éléments entrés dans la somme. */
  counted: number;
  /** Absences ou matières sans moyenne, exclues du dénominateur. */
  excluded: number;
  /** Somme des coefficients réellement utilisés. 0 si rien n'est compté. */
  coefficientSum: number;
};

export type WeightedValue = {
  coefficient: number;
  /** `null` : exclu, jamais compté comme 0. */
  value: number | null;
};

export type SubjectInput = {
  id: string;
  coefficient: number;
  grades: readonly GradeInput[];
};

export type SubjectReport = {
  id: string;
  coefficient: number;
  average: AverageResult;
};

export type PeriodReport = {
  subjects: SubjectReport[];
  overall: AverageResult;
};

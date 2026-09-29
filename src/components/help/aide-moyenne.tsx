import { computeSubjectAverage, listAppreciationBands } from "@/lib/grading";
import { formatMoyenne } from "@/lib/format";

const exemple = computeSubjectAverage([
  { score: 15, maxScore: 20, coefficient: 4 },
  { score: 12, maxScore: 20, coefficient: 2 },
]);

export function AideMoyenne() {
  const bandes = listAppreciationBands();
  return (
    <details className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-primary">Comment est calculée la moyenne ?</summary>
      <p className="mt-2 text-muted">
        Chaque note est ramenée sur 20, puis pondérée par le coefficient de l&apos;évaluation. Les absences sont ignorées.
        Deux évaluations, 15/20 coefficient 4 et 12/20 coefficient 2 : (15 × 4 + 12 × 2) / (4 + 2) = {formatMoyenne(exemple.value)}.
      </p>
      <ul className="mt-2 space-y-1">
        {bandes.map((palier) => (
          <li key={palier.code}>
            {palier.maxInclusive
              ? `${formatMoyenne(palier.min)} à ${formatMoyenne(palier.max)}`
              : `${formatMoyenne(palier.min)} à moins de ${formatMoyenne(palier.max)}`}
            {" : "}
            {palier.label}
          </li>
        ))}
        <li>Sans moyenne : Non évalué</li>
      </ul>
    </details>
  );
}

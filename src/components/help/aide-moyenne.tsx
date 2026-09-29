import { BAREME_APPRECIATION } from "@/lib/grading";

export function AideMoyenne() {
  return (
    <details className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-primary">Comment est calculée la moyenne ?</summary>
      <p className="mt-2 text-muted">
        Chaque note est ramenée sur 20, puis pondérée par le coefficient de l&apos;évaluation. Les absences sont ignorées.
        Deux évaluations, 15/20 coefficient 4 et 12/20 coefficient 2 : (15 × 4 + 12 × 2) / (4 + 2) = 14.
      </p>
      <ul className="mt-2 space-y-1">
        {BAREME_APPRECIATION.map((palier) => (
          <li key={palier.min}>
            À partir de {palier.min} : {palier.libelle}
          </li>
        ))}
        <li>Sans moyenne : Non noté</li>
      </ul>
    </details>
  );
}

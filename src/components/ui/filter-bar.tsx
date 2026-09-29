"use client";

export type FiltreOption = { value: string; label: string };

export type FiltreActif = {
  id: string;
  label: string;
  valeur: string;
  onRetirer: () => void;
};

export function FilterBar({
  children,
  pastilles,
  onReinitialiser,
}: {
  children?: React.ReactNode;
  pastilles: FiltreActif[];
  onReinitialiser?: () => void;
}) {
  return (
    <div className="space-y-3">
      {children ? <div className="flex flex-wrap items-end gap-3">{children}</div> : null}
      {pastilles.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {pastilles.map((pastille) => (
            <button
              key={pastille.id}
              type="button"
              onClick={pastille.onRetirer}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span>
                {pastille.label} : {pastille.valeur}
              </span>
              <span className="text-muted" aria-hidden="true">
                ×
              </span>
              <span className="sr-only">Retirer le filtre {pastille.label}</span>
            </button>
          ))}
          {onReinitialiser ? (
            <button
              type="button"
              onClick={onReinitialiser}
              className="text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Réinitialiser les filtres
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

export default function Erreur({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-6">
      <p className="text-sm text-danger">Impossible de charger les données.</p>
      <button type="button" onClick={reset} className="mt-3 text-sm font-medium text-primary">
        Réessayer
      </button>
    </div>
  );
}

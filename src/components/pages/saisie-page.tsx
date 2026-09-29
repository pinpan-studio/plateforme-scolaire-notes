"use client";

import { api } from "@/lib/api-client";
import { useApiData } from "@/components/data/use-api-data";
import { QueryGate } from "@/components/data/query-gate";
import { SaisieNotes } from "@/components/grades/saisie-notes";

export function SaisiePage({ evaluationId }: { evaluationId: string }) {
  const grille = useApiData(`grille-${evaluationId}`, () => api.grille(evaluationId), { interdit: "inline" });

  return (
    <QueryGate loading={grille.loading} error={grille.error} onRetry={grille.retry} hasData={grille.data !== null}>
      {grille.data ? (
        <SaisieNotes
          grille={grille.data}
          onEnregistrer={async (lignes) => {
            const reponse = await api.enregistrerNotes(evaluationId, lignes);
            grille.remplacer(reponse.grille);
          }}
        />
      ) : null}
    </QueryGate>
  );
}

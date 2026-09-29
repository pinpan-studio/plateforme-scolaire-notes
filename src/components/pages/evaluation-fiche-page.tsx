"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, messageUtilisateur } from "@/lib/api-client";
import { formatCoefficient, formatDate } from "@/lib/format";
import { libelleTypeEvaluation } from "@/lib/labels";
import { peutEcrire } from "@/lib/ui-permissions";
import { useApiData } from "@/components/data/use-api-data";
import { QueryGate } from "@/components/data/query-gate";
import { useSession } from "@/components/layout/session";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";

export function EvaluationFichePage({ evaluationId }: { evaluationId: string }) {
  const router = useRouter();
  const { session } = useSession();
  const fiche = useApiData(`evaluation-${evaluationId}`, () => api.evaluation(evaluationId));
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const evaluation = fiche.data;
  const ecriture = peutEcrire(session.utilisateur.role, "evaluation");

  async function supprimer() {
    try {
      await api.supprimerEvaluation(evaluationId);
      router.push("/evaluations");
    } catch (error) {
      setErreur(messageUtilisateur(error, "Des notes sont déjà saisies. La suppression est impossible."));
      setConfirmer(false);
    }
  }

  return (
    <QueryGate loading={fiche.loading} error={fiche.error} onRetry={fiche.retry} hasData={evaluation !== null}>
      {evaluation ? (
        <div>
          <PageHeader
            titre={evaluation.libelle}
            description={`${evaluation.classe} · ${evaluation.matiere} · ${libelleTypeEvaluation(evaluation.type)} du ${formatDate(evaluation.date)}`}
            action={
              <a href={`/evaluations/${evaluation.id}/notes`} className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white">
                {ecriture ? "Saisir les notes" : "Consulter les notes"}
              </a>
            }
          />
          <dl className="grid max-w-xl gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Période</dt><dd>{evaluation.periode}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Enseignant</dt><dd>{evaluation.enseignant}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Note maximale</dt><dd>{formatCoefficient(evaluation.noteMax)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Coefficient</dt><dd>{formatCoefficient(evaluation.coefficient)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Avancement</dt><dd>{evaluation.saisies}/{evaluation.effectif}</dd></div>
          </dl>
          {erreur ? <div className="mt-4"><Banner ton="danger">{erreur}</Banner></div> : null}
          {ecriture && evaluation.supprimable ? (
            <Button variant="danger" className="mt-6" onClick={() => setConfirmer(true)}>Supprimer</Button>
          ) : null}
          {ecriture && !evaluation.supprimable ? (
            <p className="mt-6 text-sm text-muted">{evaluation.motifSuppression ?? "Retirez les notes avant de supprimer l'évaluation."}</p>
          ) : null}
          <Dialog
            ouvert={confirmer}
            titre="Supprimer l'évaluation ?"
            description="Cette action retire l'évaluation."
            confirmerLabel="Supprimer"
            danger
            onAnnuler={() => setConfirmer(false)}
            onConfirmer={() => void supprimer()}
          />
        </div>
      ) : null}
    </QueryGate>
  );
}

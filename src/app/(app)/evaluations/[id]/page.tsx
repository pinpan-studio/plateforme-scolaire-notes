import type { Metadata } from "next";
import { EvaluationFichePage } from "@/components/pages/evaluation-fiche-page";

export const metadata: Metadata = { title: "Évaluation" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EvaluationFichePage evaluationId={id} />;
}

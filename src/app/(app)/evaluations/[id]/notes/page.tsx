import type { Metadata } from "next";
import { SaisiePage } from "@/components/pages/saisie-page";

export const metadata: Metadata = { title: "Saisie des notes" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SaisiePage evaluationId={id} />;
}

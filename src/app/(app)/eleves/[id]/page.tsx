import type { Metadata } from "next";
import { EleveFichePage } from "@/components/pages/eleve-fiche-page";

export const metadata: Metadata = { title: "Élève" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EleveFichePage eleveId={id} />;
}

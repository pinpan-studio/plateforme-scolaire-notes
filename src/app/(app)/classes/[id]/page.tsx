import type { Metadata } from "next";
import { ClasseFichePage } from "@/components/pages/classe-fiche-page";

export const metadata: Metadata = { title: "Classe" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClasseFichePage classeId={id} />;
}

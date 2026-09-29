import type { Metadata } from "next";
import { SynthesePage } from "@/components/pages/synthese-page";

export const metadata: Metadata = { title: "Synthèse" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SynthesePage classeInitiale={id} />;
}

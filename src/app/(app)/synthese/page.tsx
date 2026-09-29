import type { Metadata } from "next";
import { SynthesePage } from "@/components/pages/synthese-page";

export const metadata: Metadata = { title: "Synthèse" };

export default function Page() {
  return <SynthesePage />;
}

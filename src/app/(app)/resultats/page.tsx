import type { Metadata } from "next";
import { ResultatsPage } from "@/components/pages/resultats-page";

export const metadata: Metadata = { title: "Résultats" };

export default function Page() {
  return <ResultatsPage />;
}

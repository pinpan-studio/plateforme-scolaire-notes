import type { Metadata } from "next";
import { EnseignantsPage } from "@/components/pages/referentiel-pages";

export const metadata: Metadata = { title: "Enseignants" };

export default function Page() {
  return <EnseignantsPage />;
}

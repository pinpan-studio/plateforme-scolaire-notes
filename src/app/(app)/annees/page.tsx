import type { Metadata } from "next";
import { AnneesPage } from "@/components/pages/referentiel-pages";

export const metadata: Metadata = { title: "Années scolaires" };

export default function Page() {
  return <AnneesPage />;
}

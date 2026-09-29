import type { Metadata } from "next";
import { EtablissementPage } from "@/components/pages/referentiel-pages";

export const metadata: Metadata = { title: "Établissement" };

export default function Page() {
  return <EtablissementPage />;
}

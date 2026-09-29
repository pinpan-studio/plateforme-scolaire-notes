import type { Metadata } from "next";
import { UtilisateursPage } from "@/components/pages/referentiel-pages";

export const metadata: Metadata = { title: "Utilisateurs" };

export default function Page() {
  return <UtilisateursPage />;
}

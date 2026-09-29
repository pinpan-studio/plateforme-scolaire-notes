import type { Metadata } from "next";
import { ProfilPage } from "@/components/pages/referentiel-pages";

export const metadata: Metadata = { title: "Mon profil" };

export default function Page() {
  return <ProfilPage />;
}

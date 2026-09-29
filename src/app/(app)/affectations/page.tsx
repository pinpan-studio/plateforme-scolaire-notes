import type { Metadata } from "next";
import { AffectationsPage } from "@/components/pages/referentiel-pages";

export const metadata: Metadata = { title: "Affectations" };

export default function Page() {
  return <AffectationsPage />;
}

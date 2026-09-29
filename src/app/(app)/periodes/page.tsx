import type { Metadata } from "next";
import { PeriodesPage } from "@/components/pages/referentiel-pages";

export const metadata: Metadata = { title: "Périodes" };

export default function Page() {
  return <PeriodesPage />;
}

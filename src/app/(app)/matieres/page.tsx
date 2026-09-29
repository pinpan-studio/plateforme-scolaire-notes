import type { Metadata } from "next";
import { MatieresPage } from "@/components/pages/matieres-page";

export const metadata: Metadata = { title: "Matières" };

export default function Page() {
  return <MatieresPage />;
}

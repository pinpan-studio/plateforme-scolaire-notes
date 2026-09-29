import type { Metadata } from "next";
import { ElevesPage } from "@/components/pages/eleves-page";

export const metadata: Metadata = { title: "Élèves" };

export default function Page() {
  return <ElevesPage />;
}

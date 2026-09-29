import type { Metadata } from "next";
import { AnalysesPage } from "@/components/pages/analyses-page";

export const metadata: Metadata = { title: "Analyses" };

export default function Page() {
  return <AnalysesPage />;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { EvaluationsPage } from "@/components/pages/evaluations-page";

export const metadata: Metadata = { title: "Évaluations" };

export default function Page() {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-40" />}>
      <EvaluationsPage />
    </Suspense>
  );
}

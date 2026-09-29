import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnexionPage } from "@/components/pages/connexion-page";

export const metadata: Metadata = { title: "Connexion" };

export default function Page() {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-screen" />}>
      <ConnexionPage />
    </Suspense>
  );
}

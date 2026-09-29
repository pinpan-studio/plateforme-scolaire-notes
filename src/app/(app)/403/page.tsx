"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function Contenu() {
  const params = useSearchParams();
  const message =
    params.get("raison") === "affectation"
      ? "Cette classe ou cette matière ne vous est pas affectée."
      : "Cette action n'est pas disponible pour votre rôle.";
  return (
    <div>
      <h1 className="text-2xl font-semibold">Accès refusé</h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary">
        Retour au tableau de bord
      </Link>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-40" />}>
      <Contenu />
    </Suspense>
  );
}

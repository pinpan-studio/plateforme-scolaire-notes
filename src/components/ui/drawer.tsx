"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ResumeErreurs } from "@/components/ui/fields";

export function Drawer({
  ouvert,
  titre,
  onFermer,
  onSubmit,
  busy = false,
  erreurs = [],
  children,
}: {
  ouvert: boolean;
  titre: string;
  onFermer: () => void;
  onSubmit: () => void;
  busy?: boolean;
  erreurs?: string[];
  children: ReactNode;
}) {
  const panneau = useRef<HTMLDivElement>(null);
  const fermer = useRef(onFermer);
  useEffect(() => {
    fermer.current = onFermer;
  });

  useEffect(() => {
    if (!ouvert) {
      return;
    }
    const precedent = document.activeElement as HTMLElement | null;
    const premier = panneau.current?.querySelector<HTMLElement>("input, select, textarea, button");
    premier?.focus();

    function surClavier(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        fermer.current();
      }
    }

    document.addEventListener("keydown", surClavier);
    return () => {
      document.removeEventListener("keydown", surClavier);
      precedent?.focus();
    };
  }, [ouvert]);

  if (!ouvert) {
    return null;
  }

  function soumettre(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30">
      <div
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tiroir-titre"
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-sm"
      >
        <form onSubmit={soumettre} className="flex h-full flex-col">
          <div className="border-b border-border px-5 py-4">
            <h2 id="tiroir-titre" className="text-lg font-semibold">
              {titre}
            </h2>
            <p className="mt-1 text-sm text-muted">Champs obligatoires</p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <ResumeErreurs messages={erreurs} />
            {children}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
            <Button variant="secondary" onClick={onFermer} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" busy={busy}>
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

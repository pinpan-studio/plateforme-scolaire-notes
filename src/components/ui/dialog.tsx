"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

export function Dialog({
  ouvert,
  titre,
  description,
  confirmerLabel,
  annulerLabel = "Annuler",
  danger = false,
  onConfirmer,
  onAnnuler,
}: {
  ouvert: boolean;
  titre: string;
  description: string;
  confirmerLabel: string;
  annulerLabel?: string;
  danger?: boolean;
  onConfirmer: () => void;
  onAnnuler: () => void;
}) {
  const panneau = useRef<HTMLDivElement>(null);
  const annulerRef = useRef<HTMLButtonElement>(null);
  const confirmerRef = useRef<HTMLButtonElement>(null);

  const annulerCallback = useRef(onAnnuler);
  useEffect(() => {
    annulerCallback.current = onAnnuler;
  });

  useEffect(() => {
    if (!ouvert) {
      return;
    }
    const precedent = document.activeElement as HTMLElement | null;
    (danger ? annulerRef : confirmerRef).current?.focus();

    function surClavier(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        annulerCallback.current();
        return;
      }
      if (event.key !== "Tab" || !panneau.current) {
        return;
      }
      const focusables = panneau.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea");
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];
      if (!premier || !dernier) {
        return;
      }
      if (event.shiftKey && document.activeElement === premier) {
        event.preventDefault();
        dernier.focus();
      } else if (!event.shiftKey && document.activeElement === dernier) {
        event.preventDefault();
        premier.focus();
      }
    }

    document.addEventListener("keydown", surClavier);
    return () => {
      document.removeEventListener("keydown", surClavier);
      precedent?.focus();
    };
  }, [ouvert, danger]);

  if (!ouvert) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        ref={panneau}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialogue-titre"
        aria-describedby="dialogue-description"
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <h2 id="dialogue-titre" className="text-lg font-semibold text-ink">
          {titre}
        </h2>
        <p id="dialogue-description" className="mt-2 text-sm text-muted">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={annulerRef} variant={danger ? "primary" : "secondary"} onClick={onAnnuler}>
            {annulerLabel}
          </Button>
          <Button ref={confirmerRef} variant={danger ? "danger" : "primary"} onClick={onConfirmer}>
            {confirmerLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

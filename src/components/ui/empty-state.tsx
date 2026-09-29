"use client";

import type { ReactNode } from "react";

export function EmptyState({
  titre,
  detail,
  action,
}: {
  titre: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center">
      <p className="text-sm font-medium text-ink">{titre}</p>
      {detail ? <p className="mt-1 text-sm text-muted">{detail}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
      <p className="text-sm text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Réessayer
      </button>
    </div>
  );
}

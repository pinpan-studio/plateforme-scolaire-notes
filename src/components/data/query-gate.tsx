"use client";

import type { ReactNode } from "react";
import { useDelai } from "@/components/data/use-api-data";
import { Banner } from "@/components/ui/banner";
import { ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";

export function QueryGate({
  loading,
  error,
  onRetry,
  hasData,
  children,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  hasData: boolean;
  children: ReactNode;
}) {
  const montrerSquelette = useDelai(loading && !hasData);
  if (loading && !hasData) {
    if (!montrerSquelette) {
      return <div aria-busy="true" className="min-h-40" />;
    }
    return <TableSkeleton />;
  }
  if (error && !hasData) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }
  return (
    <div className="space-y-4">
      {error ? <Banner ton="danger">{error}</Banner> : null}
      {children}
    </div>
  );
}

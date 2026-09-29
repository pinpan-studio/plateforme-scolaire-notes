import { cx } from "@/lib/cx";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-lg bg-slate-200", className)} />;
}

export function TableSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-2/3" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <TableSkeleton />
    </div>
  );
}

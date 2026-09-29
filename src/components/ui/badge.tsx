import { cx } from "@/lib/cx";

const TONS = {
  neutral: "bg-slate-100 text-ink",
  success: "bg-green-50 text-success",
  warning: "bg-amber-50 text-warning",
  danger: "bg-red-50 text-danger",
  info: "bg-blue-50 text-primary",
} as const;

export function Badge({
  children,
  ton = "neutral",
}: {
  children: string;
  ton?: keyof typeof TONS;
}) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", TONS[ton])}>
      {children}
    </span>
  );
}

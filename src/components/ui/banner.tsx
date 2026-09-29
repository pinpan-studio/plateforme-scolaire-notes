"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type Ton = "success" | "warning" | "danger" | "info";

const TONS: Record<Ton, string> = {
  success: "border-green-200 bg-green-50 text-success",
  warning: "border-amber-200 bg-amber-50 text-warning",
  danger: "border-red-200 bg-red-50 text-danger",
  info: "border-blue-200 bg-blue-50 text-primary",
};

export function Banner({
  ton,
  children,
}: {
  ton: Ton;
  children: ReactNode;
}) {
  return (
    <p role={ton === "danger" ? "alert" : "status"} className={cx("rounded-lg border px-3 py-2 text-sm", TONS[ton])}>
      {children}
    </p>
  );
}

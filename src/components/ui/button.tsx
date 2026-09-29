"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTES: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-blue-800",
  secondary: "border border-border bg-card text-ink hover:bg-slate-50",
  danger: "text-danger hover:bg-red-50",
  ghost: "text-primary hover:bg-blue-50",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }
>(function Button({ variant = "primary", busy = false, className, children, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      disabled={disabled || busy}
      className={cx(
        "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTES[variant],
        className,
      )}
    >
      {busy ? "Enregistrement…" : children}
    </button>
  );
});

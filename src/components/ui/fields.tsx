"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

const champ =
  "w-full rounded-lg border-2 border-border bg-card px-3 py-2 text-base text-ink focus-visible:border-primary focus-visible:outline-none disabled:bg-slate-100";

export function TextField({
  id,
  label,
  obligatoire = false,
  erreur,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  obligatoire?: boolean;
  erreur?: string;
}) {
  const description = erreur ? `${id}-erreur` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
        {obligatoire ? (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <input
        id={id}
        aria-invalid={erreur ? true : undefined}
        aria-required={obligatoire || undefined}
        aria-describedby={description}
        className={cx(champ, erreur && "border-danger")}
        {...props}
      />
      {erreur ? (
        <p id={description} className="mt-1 text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  id,
  label,
  obligatoire = false,
  erreur,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  obligatoire?: boolean;
  erreur?: string;
  children: ReactNode;
}) {
  const description = erreur ? `${id}-erreur` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
        {obligatoire ? (
          <span aria-hidden="true" className="text-danger">
            {" "}
            *
          </span>
        ) : null}
      </label>
      <select
        id={id}
        aria-invalid={erreur ? true : undefined}
        aria-required={obligatoire || undefined}
        aria-describedby={description}
        className={cx(champ, erreur && "border-danger")}
        {...props}
      >
        {children}
      </select>
      {erreur ? (
        <p id={description} className="mt-1 text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  erreur,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string; erreur?: string }) {
  const description = erreur ? `${id}-erreur` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={description}
        className={cx(champ, "min-h-24", erreur && "border-danger")}
        {...props}
      />
      {erreur ? (
        <p id={description} className="mt-1 text-sm text-danger">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

export function ResumeErreurs({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
      <p>Corrigez les champs signalés.</p>
      <ul className="mt-1 list-disc pl-5">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

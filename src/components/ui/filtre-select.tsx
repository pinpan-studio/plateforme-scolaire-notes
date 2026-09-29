"use client";

export function FiltreSelect({
  id,
  label,
  value,
  onChange,
  options,
  tousLabel = "Tous",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (valeur: string) => void;
  options: { value: string; label: string }[];
  tousLabel?: string;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-medium text-ink">
      {label}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block min-w-40 rounded-lg border-2 border-border bg-card px-2 py-2 text-base focus-visible:border-primary focus-visible:outline-none"
      >
        <option value="">{tousLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

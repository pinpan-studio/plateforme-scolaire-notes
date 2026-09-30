"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNombre } from "@/lib/format";

type Point = { libelle: string; valeur: number | null; effectif: number };

function Infobulle({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value?: number; payload?: Point }[];
}) {
  const point = payload?.[0];
  if (!active || !point?.payload || point.value === undefined || point.value === null) {
    return null;
  }
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink">
      <p>{point.payload.libelle}</p>
      <p>
        {formatNombre(Number(point.value))} — effectif {point.payload.effectif}
      </p>
    </div>
  );
}

export function GraphiqueBarres({
  points,
  libelleValeur,
  legende,
  sens = "vertical",
}: {
  points: Point[];
  libelleValeur: string;
  legende?: string;
  sens?: "vertical" | "horizontal";
}) {
  const series = points.filter((point): point is Point & { valeur: number } => point.valeur !== null);
  if (series.length === 0) {
    return <p className="text-sm text-muted">Aucune donnée à afficher.</p>;
  }
  const libelle = legende ?? `Graphique ${libelleValeur}`;
  const resume = series.map((point) => `${point.libelle} : ${formatNombre(point.valeur)}, effectif ${point.effectif}`).join(". ");
  const etiquette = `${libelle}. ${resume}`;
  if (sens === "horizontal") {
    return (
      <div className="w-full min-w-0" style={{ height: Math.max(288, series.length * 44) }} role="img" aria-label={etiquette}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={series} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#475569", fontSize: 12 }} />
            <YAxis type="category" dataKey="libelle" width="auto" tick={{ fill: "#475569", fontSize: 12 }} />
            <Tooltip content={<Infobulle />} />
            <Bar dataKey="valeur" name={libelleValeur} fill="#1d4ed8" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div className="w-full overflow-x-auto">
      <div className="h-72 w-full" style={{ minWidth: Math.max(280, series.length * 120) }} role="img" aria-label={etiquette}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={series}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="libelle" tick={{ fill: "#475569", fontSize: 12 }} interval={0} angle={-20} height={70} textAnchor="end" />
            <YAxis tick={{ fill: "#475569", fontSize: 12 }} width={40} />
            <Tooltip content={<Infobulle />} />
            <Bar dataKey="valeur" name={libelleValeur} fill="#1d4ed8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function GraphiqueEvolution({ points }: { points: Point[] }) {
  const utiles = points.filter((point) => point.valeur !== null);
  if (utiles.length < 2) {
    return <p className="text-sm text-muted">Au moins deux périodes avec des notes sont nécessaires.</p>;
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <CartesianGrid stroke="#e2e8f0" vertical={false} />
          <XAxis dataKey="libelle" tick={{ fill: "#475569", fontSize: 12 }} />
          <YAxis domain={[0, 20]} tick={{ fill: "#475569", fontSize: 12 }} />
          <Tooltip content={<Infobulle />} />
          <Line type="monotone" dataKey="valeur" name="Moyenne" stroke="#1d4ed8" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TableauDonnees({ points, colonne }: { points: Point[]; colonne: string }) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-medium text-primary">Voir les données</summary>
      <table className="mt-2 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className="border-b border-border px-2 py-1 text-left">Libellé</th>
            <th scope="col" className="border-b border-border px-2 py-1 text-left">{colonne}</th>
            <th scope="col" className="border-b border-border px-2 py-1 text-left">Effectif</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.libelle}>
              <th scope="row" className="px-2 py-1 text-left font-normal">{point.libelle}</th>
              <td className="px-2 py-1">{point.valeur === null ? "—" : formatNombre(point.valeur)}</td>
              <td className="px-2 py-1">{point.effectif}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const routeur = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => routeur,
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Bar: () => null,
  Line: () => null,
}));

import { api } from "@/lib/api-client";
import type { Session } from "@/lib/api-client/types";
import { SessionProvider } from "@/components/layout/session";
import { AnalysesPage } from "@/components/pages/analyses-page";

const session: Session = {
  utilisateur: {
    id: "u",
    email: "admin@tilleuls.demo",
    prenom: "Alex",
    nom: "Admin",
    role: "ADMIN",
    enseignantId: null,
    telephone: null,
  },
  etablissement: { id: "etab", nom: "Collège Les Tilleuls" },
  anneeActive: {
    id: "annee",
    libelle: "2025-2026",
    dateDebut: "2025-09-01",
    dateFin: "2026-07-04",
    statut: "EN_COURS",
  },
  annees: [
    {
      id: "annee",
      libelle: "2025-2026",
      dateDebut: "2025-09-01",
      dateFin: "2026-07-04",
      statut: "EN_COURS",
    },
  ],
};

function rendre() {
  return render(
    <SessionProvider session={session}>
      <AnalysesPage />
    </SessionProvider>,
  );
}

describe("écran Analyses", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function reponsesVides() {
    vi.spyOn(api, "classes").mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
    vi.spyOn(api, "matieres").mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
    vi.spyOn(api, "periodes").mockResolvedValue([]);
    vi.spyOn(api, "evolution").mockResolvedValue({ points: [] });
    vi.spyOn(api, "sousSeuil").mockResolvedValue({ seuil: 10, effectif: 0, eleves: [] });
  }

  it("affiche les séries de démo et un libellé accessible", async () => {
    reponsesVides();
    vi.spyOn(api, "distribution").mockResolvedValue({
      tranches: [
        { libelle: "Très bien", min: 16, max: 20, effectif: 8 },
        { libelle: "Bien", min: 14, max: 16, effectif: 0 },
      ],
    });
    vi.spyOn(api, "moyennesMatieres").mockResolvedValue({
      matieres: [{ matiereId: "math", nom: "Mathématiques", moyenne: 11.12, effectif: 14 }],
    });
    rendre();
    expect(await screen.findByRole("img", { name: /Distribution des moyennes générales/ })).toHaveAccessibleName(/Très bien/);
    expect(screen.getByRole("img", { name: /Moyenne par matière/ })).toHaveAccessibleName(/Mathématiques/);
    expect(screen.getByRole("img", { name: /Bien/ })).toBeInTheDocument();
    expect(screen.queryByText("Aucune donnée disponible.")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Évolution" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Élèves sous 10/20" })).toBeInTheDocument();
  });

  it("annonce le chargement puis l'absence de données", async () => {
    reponsesVides();
    vi.spyOn(api, "distribution").mockReturnValue(new Promise(() => undefined));
    vi.spyOn(api, "moyennesMatieres").mockResolvedValue({ matieres: [] });
    rendre();
    const distribution = screen.getByRole("heading", { name: "Distribution des moyennes générales" }).closest("section");
    expect(distribution).toHaveAttribute("aria-busy", "true");
    expect(distribution).toHaveTextContent("Chargement des données.");
    expect(await screen.findByText("Aucune donnée disponible.")).toBeInTheDocument();
  });

  it("affiche l'erreur de chargement sans la remplacer par une série vide", async () => {
    reponsesVides();
    vi.spyOn(api, "distribution").mockResolvedValue({ tranches: [] });
    vi.spyOn(api, "moyennesMatieres").mockRejectedValue(new TypeError("Failed to fetch"));
    rendre();
    const alerte = await screen.findByRole("alert");
    expect(alerte).toHaveTextContent("Impossible de charger les données.");
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
    const matieres = screen.getByRole("heading", { name: "Moyenne par matière" }).closest("section");
    expect(matieres).not.toHaveTextContent("Aucune donnée disponible.");
  });
});

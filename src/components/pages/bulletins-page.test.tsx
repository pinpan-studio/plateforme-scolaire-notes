import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Bulletin } from "@/lib/api-client/types";
import { BulletinsPage } from "@/components/pages/bulletins-page";

const mocks = vi.hoisted(() => ({
  classes: vi.fn(),
  periodes: vi.fn(),
  eleves: vi.fn(),
  bulletin: vi.fn(),
  enregistrerAppreciation: vi.fn(),
}));

vi.mock("@/components/layout/session", () => ({
  useSession: () => ({ anneeId: "annee-1" }),
}));

vi.mock("next/navigation", () => {
  const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
  return {
    useRouter: () => router,
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
  };
});

vi.mock("@/lib/api-client", () => {
  class ApiError extends Error {
    status = 0;
    code = "";
    champs: { champ: string; message: string }[] = [];
  }
  return {
    ApiError,
    messageUtilisateur: (_error: unknown, repli = "Impossible de charger les données.") => repli,
    raisonInterdit: () => "role",
    api: {
      classes: mocks.classes,
      periodes: mocks.periodes,
      eleves: mocks.eleves,
      bulletin: mocks.bulletin,
      enregistrerAppreciation: mocks.enregistrerAppreciation,
    },
  };
});

function bulletinHugo(partiel: Partial<Bulletin> = {}): Bulletin {
  return {
    etablissement: { nom: "Collège Les Tilleuls", adresse: "1 rue des Écoles" },
    eleve: { id: "e1", matricule: "MAT-1", nom: "Bernard", prenom: "Hugo" },
    classe: { id: "c1", nom: "6e A", effectif: 14 },
    periode: { id: "p1", libelle: "Trimestre 1" },
    matieres: [
      {
        matiereId: "fr",
        nom: "Français",
        coefficient: 4,
        moyenne: 5.83,
        appreciation: "Très insuffisant",
        rang: 13,
        effectifClasse: 14,
      },
      {
        matiereId: "eps",
        nom: "EPS",
        coefficient: 1,
        moyenne: 12,
        appreciation: "Assez bien",
        rang: 11,
        effectifClasse: 14,
      },
      {
        matiereId: "arts",
        nom: "Arts",
        coefficient: 1,
        moyenne: null,
        appreciation: "Non noté",
        rang: null,
        effectifClasse: 14,
      },
    ],
    moyenneGenerale: 6.86,
    rang: 13,
    effectifClasse: 14,
    appreciation: "Très insuffisant",
    appreciationGenerale: "Travail sérieux, à poursuivre.",
    peutRedigerAppreciation: false,
    matieresSansNote: 1,
    reduitAuxMatieres: false,
    ...partiel,
  };
}

const APP_PERIODE = "Aucune appréciation générale. Elle est enregistrée pour une période.";

async function ouvrirHugo(user: ReturnType<typeof userEvent.setup>, periode = true) {
  await screen.findByRole("option", { name: "6e A" });
  await user.selectOptions(screen.getByRole("combobox", { name: "Classe" }), "c1");
  if (periode) {
    await screen.findByRole("option", { name: "Trimestre 1" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Période" }), "p1");
  }
  await screen.findByRole("option", { name: "Bernard Hugo" });
  await user.selectOptions(screen.getByRole("combobox", { name: "Élève" }), "e1");
}

describe("écran bulletin", () => {
  beforeEach(() => {
    mocks.classes.mockResolvedValue({
      items: [{ id: "c1", nom: "6e A" }],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    mocks.periodes.mockResolvedValue([
      { id: "p1", anneeScolaireId: "annee-1", libelle: "Trimestre 1", ordre: 1, dateDebut: "2025-09-01", dateFin: "2025-12-01" },
    ]);
    mocks.eleves.mockResolvedValue({
      items: [{ id: "e1", nom: "Bernard", prenom: "Hugo" }],
      total: 1,
      page: 1,
      pageSize: 100,
    });
    mocks.bulletin.mockResolvedValue(bulletinHugo());
    mocks.enregistrerAppreciation.mockResolvedValue({ texte: "Travail sérieux, à poursuivre." });
  });

  it("invite à choisir un élève", async () => {
    render(<BulletinsPage />);
    expect(await screen.findByText("Choisissez une classe, puis un élève.")).toBeInTheDocument();
  });

  it("affiche le rang général, le rang par matière et l'appréciation rédigée", async () => {
    const user = userEvent.setup();
    render(<BulletinsPage />);
    await ouvrirHugo(user);

    expect(await screen.findByRole("heading", { name: "Bulletin" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Français/ })).toHaveTextContent("13e / 14");
    expect(screen.getByRole("row", { name: /EPS/ })).toHaveTextContent("11e / 14");
    expect(screen.getByRole("row", { name: /Arts/ })).toHaveTextContent("Non classé");
    expect(screen.getByText("13e / 14", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Travail sérieux, à poursuivre.")).toBeInTheDocument();
    expect(screen.getByText("Très insuffisant", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("6,86", { selector: "dd" })).toBeInTheDocument();
    expect(screen.queryByText("Le rang porte sur")).not.toBeInTheDocument();
  });

  it("annonce l'absence de texte et le rang manquant, et distingue inscrits et classés", async () => {
    mocks.bulletin.mockResolvedValue(
      bulletinHugo({
        rang: null,
        effectifClasse: 12,
        classe: { id: "c1", nom: "6e A", effectif: 14 },
        appreciationGenerale: null,
        matieres: [
          {
            matiereId: "fr",
            nom: "Français",
            coefficient: 4,
            moyenne: null,
            appreciation: "Non noté",
            rang: null,
            effectifClasse: 0,
          },
        ],
      }),
    );
    const user = userEvent.setup();
    render(<BulletinsPage />);
    await ouvrirHugo(user);

    expect(await screen.findByText("Aucune appréciation générale.")).toBeInTheDocument();
    expect(screen.getByText("Non classé", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("Non classé", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Le rang porte sur 12 élèves classés, pour 14 inscrits.")).toBeInTheDocument();
    expect(screen.queryByText(/\/ 0/)).not.toBeInTheDocument();
  });

  it("précise que l'appréciation se consulte pour une période", async () => {
    mocks.bulletin.mockImplementation(async (_eleveId: string, params: { periodeId?: string }) =>
      bulletinHugo({
        periode: params.periodeId ? { id: params.periodeId, libelle: "Trimestre 1" } : null,
        appreciationGenerale: params.periodeId ? "Travail sérieux, à poursuivre." : null,
      }),
    );
    const user = userEvent.setup();
    render(<BulletinsPage />);
    await ouvrirHugo(user, false);

    expect(await screen.findByText(APP_PERIODE)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Période" }), "p1");
    expect(await screen.findByText("Travail sérieux, à poursuivre.")).toBeInTheDocument();
  });

  it("affiche l'erreur de chargement et permet de réessayer", async () => {
    mocks.bulletin.mockRejectedValueOnce(new Error("réseau"));
    const user = userEvent.setup();
    render(<BulletinsPage />);
    await ouvrirHugo(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Impossible de charger les données.");
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByText("Travail sérieux, à poursuivre.")).toBeInTheDocument();
  });

  it("laisse rédiger l'appréciation quand le rôle le permet", async () => {
    mocks.bulletin.mockResolvedValue(bulletinHugo({ peutRedigerAppreciation: true, appreciationGenerale: "" }));
    const user = userEvent.setup();
    render(<BulletinsPage />);
    await ouvrirHugo(user);

    const champ = await screen.findByRole("textbox", { name: "Appréciation générale" });
    expect(champ).toHaveValue("");
    expect(screen.getByText("Aucune appréciation générale.")).toBeInTheDocument();
    await user.type(champ, "Encouragements.");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(mocks.enregistrerAppreciation).toHaveBeenCalledWith({
      eleveId: "e1",
      periodeId: "p1",
      texte: "Encouragements.",
    });
  });
});

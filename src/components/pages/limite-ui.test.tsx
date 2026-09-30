import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/components/layout/session";
import { ConnexionPage } from "@/components/pages/connexion-page";
import { ProfilPage, UtilisateursPage } from "@/components/pages/referentiel-pages";
import { ToastProvider } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api-client";
import type { Session } from "@/lib/api-client/types";

const MESSAGE = "Trop de tentatives. Réessayez plus tard.";

const session: Session = {
  utilisateur: {
    id: "admin",
    email: "admin@tilleuls.demo",
    prenom: "Ada",
    nom: "Admin",
    role: "ADMIN",
    enseignantId: null,
    telephone: null,
  },
  etablissement: { id: "etab", nom: "Les Tilleuls" },
  anneeActive: null,
  annees: [],
};

function avecSession(ui: ReactNode) {
  return (
    <ToastProvider>
      <SessionProvider session={session}>{ui}</SessionProvider>
    </ToastProvider>
  );
}

describe("affichage des 429", () => {
  it("affiche le 429 sur la connexion", async () => {
    vi.spyOn(api, "etablissementPublic").mockResolvedValue({ nom: "Les Tilleuls" });
    vi.spyOn(api, "connexion").mockRejectedValue(new ApiError(429, "TROP_DE_TENTATIVES", MESSAGE));
    const user = userEvent.setup();
    render(<ConnexionPage />);
    await user.type(screen.getByLabelText(/E-mail/), "admin@tilleuls.demo");
    await user.type(screen.getByLabelText(/^Mot de passe/), "Demo-2026!");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGE);
  });

  it("affiche le 429 du changement de mot de passe", async () => {
    vi.spyOn(api, "changerMotDePasse").mockRejectedValue(new ApiError(429, "TROP_DE_TENTATIVES", MESSAGE));
    const user = userEvent.setup();
    render(avecSession(<ProfilPage />));
    await user.type(screen.getByLabelText(/Mot de passe actuel/), "actuel-mot-de-passe");
    await user.type(screen.getByLabelText(/Nouveau mot de passe/), "nouveau-mot-de-passe");
    await user.type(screen.getByLabelText(/Confirmation/), "nouveau-mot-de-passe");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGE);
  });

  it("affiche le 429 du mot de passe temporaire", async () => {
    vi.spyOn(api, "utilisateurs").mockResolvedValue([
      {
        id: "u1",
        email: "lea@tilleuls.demo",
        prenom: "Léa",
        nom: "Dubois",
        role: "CONSULTATION",
        enseignantId: null,
        enseignant: null,
        actif: true,
      },
    ]);
    vi.spyOn(api, "enseignants").mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
    vi.spyOn(api, "motDePasseTemporaire").mockRejectedValue(new ApiError(429, "TROP_DE_TENTATIVES", MESSAGE));
    const user = userEvent.setup();
    render(avecSession(<UtilisateursPage />));
    await user.click(await screen.findByRole("button", { name: "Définir un nouveau mot de passe temporaire" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGE);
  });
});

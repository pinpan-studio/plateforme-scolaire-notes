import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";

type Ligne = { id: string; nom: string };

const colonnes = [
  {
    key: "nom",
    entete: "Nom",
    triable: true,
    valeurTri: (ligne: Ligne) => ligne.nom,
    cellule: (ligne: Ligne) => ligne.nom,
  },
];

function tableau(lignes: Ligne[]) {
  return (
    <DataTable
      lignes={lignes}
      colonnes={colonnes}
      getId={(ligne) => ligne.id}
      texteRecherche={(ligne) => ligne.nom}
      hrefLigne={(ligne) => `/eleves/${ligne.id}`}
      singulier="élève"
      pluriel="élèves"
      titreVide="Aucun élève."
    />
  );
}

describe("tableau", () => {
  it("trie une colonne et l'annonce", async () => {
    const user = userEvent.setup();
    render(
      tableau([
        { id: "1", nom: "Martin" },
        { id: "2", nom: "Albert" },
        { id: "3", nom: "Bernard" },
      ]),
    );
    await user.click(screen.getByRole("button", { name: "Trier par Nom" }));
    expect(screen.getByRole("button", { name: "Nom, tri croissant" })).toBeInTheDocument();
    const lignes = screen.getAllByRole("row");
    expect(lignes[1]).toHaveTextContent("Albert");
    expect(lignes[2]).toHaveTextContent("Bernard");
    expect(lignes[3]).toHaveTextContent("Martin");
  });

  it("filtre la recherche et met à jour le compteur", async () => {
    const user = userEvent.setup();
    render(
      tableau([
        { id: "1", nom: "Dupont" },
        { id: "2", nom: "Martin" },
      ]),
    );
    await user.type(screen.getByRole("textbox", { name: "Rechercher" }), "dupont");
    expect(screen.getByText("1 résultat pour « dupont »")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Effacer" }));
    expect(screen.getByText("2 élèves")).toBeInTheDocument();
  });

  it("pagine au-delà de 25 lignes", async () => {
    const user = userEvent.setup();
    const lignes = Array.from({ length: 26 }, (_, index) => ({ id: String(index), nom: `Élève ${index}` }));
    render(tableau(lignes));
    expect(screen.getByText("Page 1 sur 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Page suivante" }));
    expect(screen.getByText("Page 2 sur 2")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("affiche l'état vide", () => {
    render(tableau([]));
    expect(screen.getByText("Aucun élève.")).toBeInTheDocument();
  });
});

describe("filtres", () => {
  it("retire une pastille et propose la réinitialisation", async () => {
    const user = userEvent.setup();
    const onRetirer = vi.fn();
    const onReinitialiser = vi.fn();
    render(
      <FilterBar
        pastilles={[{ id: "classe", label: "Classe", valeur: "6e A", onRetirer }]}
        onReinitialiser={onReinitialiser}
      />,
    );
    expect(screen.getByRole("button", { name: /Classe : 6e A/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Retirer le filtre Classe/ }));
    expect(onRetirer).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Réinitialiser les filtres" }));
    expect(onReinitialiser).toHaveBeenCalledOnce();
  });
});

import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, TEXTE_EVALUATION_DEJA_NOTEE, TEXTE_REOUVERTURE_INTERDITE } from "@/lib/api-client";
import type { Annee, ClasseResume, EleveFiche, EvaluationDetail, Matiere, Periode, Role, Session } from "@/lib/api-client/types";
import { SessionProvider } from "@/components/layout/session";
import { ToastProvider } from "@/components/ui/toast";
import { AnneesPage } from "@/components/pages/referentiel-pages";
import { EleveFichePage } from "@/components/pages/eleve-fiche-page";
import { EvaluationFichePage } from "@/components/pages/evaluation-fiche-page";

afterEach(() => {
  vi.restoreAllMocks();
});

function sessionDe(role: Role): Session {
  return {
    utilisateur: {
      id: "u",
      email: "ada@tilleuls.demo",
      prenom: "Ada",
      nom: "Lovelace",
      role,
      enseignantId: null,
      telephone: null,
    },
    etablissement: { id: "etab", nom: "Collège" },
    anneeActive: { id: "active", libelle: "2025-2026", dateDebut: "2025-09-01", dateFin: "2026-07-01", statut: "EN_COURS" },
    annees: [],
  };
}

function rendu(role: Role, ui: ReactNode) {
  return render(
    <SessionProvider session={sessionDe(role)}>
      <ToastProvider>{ui}</ToastProvider>
    </SessionProvider>,
  );
}

const annees: Annee[] = [
  { id: "close", libelle: "2024-2025", dateDebut: "2024-09-01", dateFin: "2025-07-01", statut: "CLOTUREE" },
  { id: "brouillon", libelle: "2026-2027", dateDebut: "2026-09-01", dateFin: "2027-07-01", statut: "PREPARATION" },
  { id: "active", libelle: "2025-2026", dateDebut: "2025-09-01", dateFin: "2026-07-01", statut: "EN_COURS" },
];

function classe(id: string, nom: string): ClasseResume {
  return {
    id,
    nom,
    niveau: "6e",
    niveauId: "n",
    effectif: 10,
    professeurPrincipal: null,
    professeurPrincipalId: null,
    annee: "2025-2026",
    anneeScolaireId: "active",
  };
}

function evaluation(saisies: number): EvaluationDetail {
  return {
    id: "ev",
    date: "2026-01-15",
    type: "DEVOIR",
    libelle: "Devoir 1",
    matiere: "Mathématiques",
    matiereId: "m1",
    classe: "6e A",
    classeId: "c1",
    periode: "Trimestre 1",
    periodeId: "p1",
    noteMax: 20,
    coefficient: 1,
    saisies,
    effectif: 28,
    enseignantId: "ens",
    enseignant: "Nathan Durand",
    anneeScolaireId: "active",
    supprimable: saisies === 0,
    motifSuppression: saisies === 0 ? null : "Des notes sont déjà saisies. La suppression est impossible.",
  };
}

const matiere: Matiere = { id: "m1", code: "MATH", nom: "Mathématiques", coefficient: 4, niveauId: null, niveau: null };
const periode: Periode = {
  id: "p1",
  anneeScolaireId: "active",
  libelle: "Trimestre 1",
  ordre: 1,
  dateDebut: "2025-09-01",
  dateFin: "2025-12-20",
};

describe("réouverture d'année", () => {
  it("explique et désactive la réouverture pour la direction", async () => {
    vi.spyOn(api, "annees").mockResolvedValue(annees);
    const activer = vi.spyOn(api, "activerAnnee");
    rendu("DIRECTION", <AnneesPage />);
    expect(await screen.findByRole("status")).toHaveTextContent(TEXTE_REOUVERTURE_INTERDITE);
    const ligne = screen.getByRole("row", { name: /2024-2025/ });
    const bouton = within(ligne).getByRole("button", { name: "Activer" });
    expect(bouton).toHaveAttribute("aria-disabled", "true");
    expect(bouton).toHaveAttribute("aria-describedby", "reouverture-interdite");
    await userEvent.click(bouton);
    expect(activer).not.toHaveBeenCalled();
    const brouillon = screen.getByRole("row", { name: /2026-2027/ });
    expect(within(brouillon).getByRole("button", { name: "Activer" })).not.toHaveAttribute("aria-disabled");
  });

  it("affiche le refus de l'API sans fermer le dialogue", async () => {
    vi.spyOn(api, "annees").mockResolvedValue(annees);
    const activer = vi.spyOn(api, "activerAnnee").mockRejectedValue(
      new ApiError(403, "REOUVERTURE_INTERDITE", "Seule l'administration peut rouvrir une année clôturée."),
    );
    rendu("ADMIN", <AnneesPage />);
    const ligne = await screen.findByRole("row", { name: /2024-2025/ });
    await userEvent.click(within(ligne).getByRole("button", { name: "Activer" }));
    const dialogue = screen.getByRole("dialog");
    const confirmer = within(dialogue).getByRole("button", { name: "Activer" });
    confirmer.click();
    confirmer.click();
    expect(activer).toHaveBeenCalledTimes(1);
    expect(await within(dialogue).findByRole("alert")).toHaveTextContent(
      "Seule l'administration peut rouvrir une année clôturée.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("affiche FORBIDDEN tel quel", async () => {
    vi.spyOn(api, "annees").mockResolvedValue(annees);
    vi.spyOn(api, "activerAnnee").mockRejectedValue(new ApiError(403, "FORBIDDEN", "Action interdite pour ce rôle."));
    rendu("ADMIN", <AnneesPage />);
    const ligne = await screen.findByRole("row", { name: /2026-2027/ });
    await userEvent.click(within(ligne).getByRole("button", { name: "Activer" }));
    within(screen.getByRole("dialog")).getByRole("button", { name: "Activer" }).click();
    expect(await screen.findByRole("alert")).toHaveTextContent("Action interdite pour ce rôle.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("déplacement d'élève", () => {
  const fiche: EleveFiche = {
    id: "el",
    matricule: "E001",
    nom: "Diallo",
    prenom: "Awa",
    dateNaissance: "2012-04-03",
    sexe: "F",
    statut: "ACTIF",
    inscription: { id: "ins", classeId: "c1", classeNom: "6e A", statut: "INSCRIT" },
    resultats: null,
    historique: [{ evaluationId: "ev", date: "2026-01-15", type: "DEVOIR", libelle: "Devoir", matiere: "Maths", periode: "T1", valeur: 12, absent: false, noteMax: 20, coefficient: 1, commentaire: null }],
  };

  it("affiche ELEVE_DEJA_NOTE et conserve la classe choisie", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "eleve").mockResolvedValue(fiche);
    vi.spyOn(api, "classes").mockResolvedValue({
      items: [classe("c1", "6e A"), classe("c2", "6e B")],
      total: 2,
      page: 1,
      pageSize: 100,
    });
    const modifier = vi.spyOn(api, "modifierEleve").mockRejectedValue(
      new ApiError(409, "ELEVE_DEJA_NOTE", "Impossible de déplacer un élève qui possède déjà des notes."),
    );
    rendu("ADMIN", <EleveFichePage eleveId="el" />);
    const select = await screen.findByRole("combobox", { name: "Classe" });
    expect(select).toHaveValue("c1");
    expect(select).toBeEnabled();
    await user.selectOptions(select, "c2");
    const enregistrer = screen.getByRole("button", { name: "Enregistrer" });
    enregistrer.click();
    enregistrer.click();
    expect(modifier).toHaveBeenCalledTimes(1);
    expect(modifier).toHaveBeenCalledWith("el", { classeId: "c2" });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Impossible de déplacer un élève qui possède déjà des notes.",
    );
    expect(screen.getByRole("combobox", { name: "Classe" })).toHaveValue("c2");
    expect(enregistrer).toBeEnabled();
  });
});

describe("évaluation déjà notée", () => {
  function preparer(saisies: number) {
    vi.spyOn(api, "evaluation").mockResolvedValue(evaluation(saisies));
    vi.spyOn(api, "classes").mockResolvedValue({
      items: [classe("c1", "6e A"), classe("c2", "6e B")],
      total: 2,
      page: 1,
      pageSize: 100,
    });
    vi.spyOn(api, "matieres").mockResolvedValue({
      items: [matiere, { ...matiere, id: "m2", code: "FR", nom: "Français" }],
      total: 2,
      page: 1,
      pageSize: 100,
    });
    vi.spyOn(api, "periodes").mockResolvedValue([
      periode,
      { ...periode, id: "p2", libelle: "Trimestre 2", ordre: 2 },
    ]);
  }

  it("désactive classe, matière, période et note maximale quand des notes existent", async () => {
    preparer(12);
    rendu("ENSEIGNANT", <EvaluationFichePage evaluationId="ev" />);
    expect(await screen.findByRole("status")).toHaveTextContent(TEXTE_EVALUATION_DEJA_NOTEE);
    expect(screen.getByRole("combobox", { name: "Classe" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Matière" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Période" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Note maximale" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Libellé" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Coefficient" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Type" })).toBeEnabled();
    expect(screen.getByLabelText(/^Date/)).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Classe" })).toHaveAttribute("aria-describedby", "evaluation-notes-figees");
  });

  it("affiche NOTE_MAX_FIGEE et conserve la saisie", async () => {
    const user = userEvent.setup();
    preparer(0);
    const modifier = vi.spyOn(api, "modifierEvaluation").mockRejectedValue(
      new ApiError(
        409,
        "NOTE_MAX_FIGEE",
        "Impossible de modifier la classe, la matière, la période ou la note maximale tant que des notes existent.",
      ),
    );
    rendu("ADMIN", <EvaluationFichePage evaluationId="ev" />);
    const noteMax = await screen.findByRole("textbox", { name: "Note maximale" });
    expect(noteMax).toBeEnabled();
    await user.clear(noteMax);
    await user.type(noteMax, "15");
    await user.clear(screen.getByRole("textbox", { name: "Libellé" }));
    await user.type(screen.getByRole("textbox", { name: "Libellé" }), "Devoir corrigé");
    const enregistrer = screen.getByRole("button", { name: "Enregistrer" });
    enregistrer.click();
    enregistrer.click();
    expect(modifier).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent(TEXTE_EVALUATION_DEJA_NOTEE);
    expect(screen.getByRole("textbox", { name: "Note maximale" })).toHaveValue("15");
    expect(screen.getByRole("textbox", { name: "Libellé" })).toHaveValue("Devoir corrigé");
    expect(enregistrer).toBeEnabled();
  });

  it("affiche EVALUATION_DEJA_NOTEE et conserve la classe choisie", async () => {
    const user = userEvent.setup();
    preparer(0);
    vi.spyOn(api, "modifierEvaluation").mockRejectedValue(
      new ApiError(
        409,
        "EVALUATION_DEJA_NOTEE",
        "Impossible de modifier la classe, la matière, la période ou la note maximale tant que des notes existent.",
      ),
    );
    rendu("ADMIN", <EvaluationFichePage evaluationId="ev" />);
    const select = await screen.findByRole("combobox", { name: "Classe" });
    await user.selectOptions(select, "c2");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(TEXTE_EVALUATION_DEJA_NOTEE);
    expect(screen.getByRole("combobox", { name: "Classe" })).toHaveValue("c2");
    expect(api.modifierEvaluation).toHaveBeenCalledWith(
      "ev",
      expect.objectContaining({ classeId: "c2", noteMax: 20, matiereId: "m1", periodeId: "p1" }),
    );
  });
});

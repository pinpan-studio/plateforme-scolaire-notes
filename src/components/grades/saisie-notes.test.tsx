import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SaisieNotes } from "@/components/grades/saisie-notes";
import type { GrilleNotes, LigneGrille } from "@/lib/api-client/types";
import { appreciate, computeSubjectAverage } from "@/lib/grading";
import { formatMoyenne } from "@/lib/format";

const eleves: LigneGrille[] = [
  { eleveId: "1", matricule: "A1", nom: "Martin", prenom: "Camille", valeur: null, absent: false, commentaire: null, version: null },
  { eleveId: "2", matricule: "A2", nom: "Durand", prenom: "Léa", valeur: null, absent: false, commentaire: null, version: null },
];

function grille(peutModifier = true): GrilleNotes {
  return {
    peutModifier,
    motifLectureSeule: peutModifier ? null : "Consultation seule",
    lignes: eleves,
    evaluation: {
      id: "ev",
      date: "2026-01-15",
      type: "DEVOIR",
      libelle: "Contrôle 1",
      matiere: "Mathématiques",
      matiereId: "m",
      classe: "6e A",
      classeId: "c",
      periode: "Trimestre 1",
      periodeId: "p",
      noteMax: 20,
      coefficient: 2,
      saisies: 0,
      effectif: 2,
      enseignantId: "ens",
      enseignant: "Camille Martin",
      anneeScolaireId: "an",
      supprimable: true,
      motifSuppression: null,
    },
  };
}

function libelleApercu(valeur: number | null): string {
  if (valeur === null) {
    return "Aperçu de la moyenne : — · Non évalué";
  }
  return `Aperçu de la moyenne : ${formatMoyenne(valeur)} · ${appreciate(valeur).label}`;
}

describe("grille de saisie", () => {
  it("affiche une ligne par élève sans pagination", () => {
    render(<SaisieNotes grille={grille()} onEnregistrer={vi.fn()} />);
    expect(screen.getByRole("row", { name: /Martin Camille/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Durand Léa/ })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
    expect(screen.getByText("0 saisies · 0 absents · 2 restantes")).toBeInTheDocument();
  });

  it("bloque une note négative ou supérieure au maximum", async () => {
    const user = userEvent.setup();
    render(<SaisieNotes grille={grille()} onEnregistrer={vi.fn()} />);
    const note = screen.getByRole("textbox", { name: "Note de Martin Camille" });
    await user.type(note, "-1");
    expect(screen.getByText("La note ne peut pas être négative.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    await user.clear(note);
    await user.type(note, "21");
    expect(screen.getByText("La note ne peut pas dépasser 20.")).toBeInTheDocument();
  });

  it("efface la note quand l'élève est absent", async () => {
    const user = userEvent.setup();
    render(<SaisieNotes grille={grille()} onEnregistrer={vi.fn()} />);
    const note = screen.getByRole("textbox", { name: "Note de Martin Camille" });
    await user.type(note, "12");
    await user.click(screen.getByRole("checkbox", { name: "Absent — Martin Camille" }));
    expect(note).toHaveValue("");
    expect(note).toBeDisabled();
    expect(screen.getByText("0 saisies · 1 absents · 1 restantes")).toBeInTheDocument();
  });

  it("déplace le focus avec Entrée et les flèches", async () => {
    const user = userEvent.setup();
    render(<SaisieNotes grille={grille()} onEnregistrer={vi.fn()} />);
    const premiere = screen.getByRole("textbox", { name: "Note de Martin Camille" });
    const seconde = screen.getByRole("textbox", { name: "Note de Durand Léa" });
    premiere.focus();
    await user.keyboard("{ArrowDown}");
    expect(seconde).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(premiere).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(seconde).toHaveFocus();
  });

  it("colle une colonne de tableur", () => {
    render(<SaisieNotes grille={grille()} onEnregistrer={vi.fn()} />);
    const premiere = screen.getByRole("textbox", { name: "Note de Martin Camille" });
    fireEvent.paste(premiere, {
      clipboardData: { getData: () => "15\n12,5" },
    });
    expect(premiere).toHaveValue("15");
    expect(screen.getByRole("textbox", { name: "Note de Durand Léa" })).toHaveValue("12,5");
  });

  it("demande confirmation avant de quitter et enregistre en masse", async () => {
    const user = userEvent.setup();
    const onEnregistrer = vi.fn().mockResolvedValue(undefined);
    const onNavigate = vi.fn();
    render(<SaisieNotes grille={grille()} onEnregistrer={onEnregistrer} onNavigate={onNavigate} />);
    await user.type(screen.getByRole("textbox", { name: "Note de Martin Camille" }), "15");
    await user.click(screen.getByRole("link", { name: "Évaluations" }));
    expect(screen.getByRole("dialog", { name: "Quitter sans enregistrer ?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rester" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onEnregistrer).toHaveBeenCalledWith([
      { eleveId: "1", valeur: 15, absent: false, commentaire: null, supprimer: false, version: null },
    ]);
  });

  it("affiche l'aperçu calculé par le module, absences et barème compris", async () => {
    const user = userEvent.setup();
    render(<SaisieNotes grille={grille()} onEnregistrer={vi.fn()} />);
    expect(screen.getByText("Aperçu de la moyenne : — · Non évalué")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: "Note de Martin Camille" }), "15");
    await user.type(screen.getByRole("textbox", { name: "Note de Durand Léa" }), "12");
    const deuxNotes = computeSubjectAverage([
      { score: 15, maxScore: 20, coefficient: 2 },
      { score: 12, maxScore: 20, coefficient: 2 },
    ]);
    expect(screen.getByText(libelleApercu(deuxNotes.value))).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Absent — Durand Léa" }));
    const sansAbsence = computeSubjectAverage([
      { score: 15, maxScore: 20, coefficient: 2 },
      { score: 0, maxScore: 20, coefficient: 2, absent: true },
    ]);
    expect(screen.getByText(libelleApercu(sansAbsence.value))).toBeInTheDocument();
  });

  it("ramène l'aperçu sur 20 quand le barème n'est pas 20", async () => {
    const user = userEvent.setup();
    const source = grille();
    render(
      <SaisieNotes
        grille={{ ...source, evaluation: { ...source.evaluation, noteMax: 10, coefficient: 1 } }}
        onEnregistrer={vi.fn()}
      />,
    );
    await user.type(screen.getByRole("textbox", { name: "Note de Martin Camille" }), "8");
    await user.type(screen.getByRole("textbox", { name: "Note de Durand Léa" }), "5");
    const resultat = computeSubjectAverage([
      { score: 8, maxScore: 10, coefficient: 1 },
      { score: 5, maxScore: 10, coefficient: 1 },
    ]);
    expect(screen.getByText(libelleApercu(resultat.value))).toBeInTheDocument();
  });

  it("reste en lecture seule sans champ éditable", () => {
    render(<SaisieNotes grille={grille(false)} onEnregistrer={vi.fn()} />);
    expect(screen.getByText("Consultation seule")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Note de Martin Camille" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
  });
});

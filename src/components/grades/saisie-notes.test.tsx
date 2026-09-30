import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SaisieNotes } from "@/components/grades/saisie-notes";
import { ApiError } from "@/lib/api-client";
import type { ConflitVersionNote, GrilleNotes, LigneGrille } from "@/lib/api-client/types";
import { appreciate, computeSubjectAverage } from "@/lib/grading";
import { formatMoyenne } from "@/lib/format";

const eleves: LigneGrille[] = [
  { eleveId: "1", matricule: "A1", nom: "Martin", prenom: "Camille", valeur: null, absent: false, commentaire: null, version: null },
  { eleveId: "2", matricule: "A2", nom: "Durand", prenom: "Léa", valeur: null, absent: false, commentaire: null, version: null },
];

function grille(peutModifier = true, motif: string | null = null): GrilleNotes {
  return {
    peutModifier,
    motifLectureSeule: peutModifier ? null : (motif ?? "Consultation seule"),
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
    expect(screen.queryByText("Verrouillée")).not.toBeInTheDocument();
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
      { eleveId: "1", valeur: 15, absent: false, commentaire: null, supprimer: false, version: null, noteId: null },
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
    expect(screen.queryByRole("checkbox", { name: /Absent/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Note de Martin Camille, cellule verrouillée. Consultation seule" })).toHaveTextContent("Verrouillée");
    expect(screen.getAllByText("Verrouillée")).toHaveLength(6);
  });

  it("explique le verrou de chaque cellule hors affectation", () => {
    const motif = "Hors de votre affectation. Vous pouvez consulter ces notes, pas les modifier.";
    render(<SaisieNotes grille={grille(false, motif)} onEnregistrer={vi.fn()} />);
    expect(screen.getByText(motif)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: `Note de Martin Camille, cellule verrouillée. ${motif}` })).toHaveTextContent("Verrouillée");
    expect(screen.getByRole("group", { name: `Absence de Durand Léa, cellule verrouillée. ${motif}` })).toHaveTextContent("Présent");
    expect(screen.getByRole("group", { name: `Commentaire de Martin Camille, cellule verrouillée. ${motif}` })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Note de/ })).not.toBeInTheDocument();
  });

  it("envoie la version lue au chargement et ignore un second clic", async () => {
    const user = userEvent.setup();
    let resoudre: (() => void) | undefined;
    const onEnregistrer = vi.fn().mockImplementation(() => new Promise<void>((resolve) => {
      resoudre = resolve;
    }));
    const source = grille();
    render(
      <SaisieNotes
        grille={{
          ...source,
          lignes: [
            { ...eleves[0], valeur: 12, version: "2026-09-30T09:16:00.123Z" },
            eleves[1],
          ],
        }}
        onEnregistrer={onEnregistrer}
      />,
    );
    const note = screen.getByRole("textbox", { name: "Note de Martin Camille" });
    await user.clear(note);
    await user.type(note, "14");
    const bouton = screen.getByRole("button", { name: "Enregistrer" });
    fireEvent.click(bouton);
    fireEvent.click(bouton);
    expect(onEnregistrer).toHaveBeenCalledTimes(1);
    expect(onEnregistrer).toHaveBeenCalledWith([
      {
        eleveId: "1",
        valeur: 14,
        absent: false,
        commentaire: null,
        supprimer: false,
        version: "2026-09-30T09:16:00.123Z",
        noteId: null,
      },
    ]);
    expect(screen.getByRole("button", { name: "Enregistrement…" })).toBeDisabled();
    expect(note).toBeDisabled();
    expect(note).toHaveValue("14");
    resoudre?.();
    expect(await screen.findByText("Notes enregistrées.")).toBeInTheDocument();
  });

  it("signale un conflit de version sans perdre la saisie ni afficher la valeur distante", async () => {
    const user = userEvent.setup();
    const versionDistante = "2026-09-30T10:00:00.000Z";
    const noteDistante = "00000000-0000-4000-8000-000000000010";
    const conflits: ConflitVersionNote[] = [
      { index: 0, noteId: noteDistante, eleveId: "1", evaluationId: "ev", version: versionDistante },
      { index: 1, noteId: null, eleveId: "2", evaluationId: "ev", version: null },
    ];
    const onEnregistrer = vi.fn().mockRejectedValue(
      new ApiError(409, "CONFLIT_VERSION", "Une ou plusieurs notes ont été modifiées. Rechargez avant d'enregistrer.", [], conflits),
    );
    const onRecharger = vi.fn().mockResolvedValue(undefined);
    const source = grille();
    const initiale: GrilleNotes = {
      ...source,
      lignes: [
        { ...eleves[0], version: "2026-09-30T09:16:00.123Z" },
        eleves[1],
      ],
    };
    const { rerender } = render(<SaisieNotes grille={initiale} onEnregistrer={onEnregistrer} onRecharger={onRecharger} />);
    const noteMartin = screen.getByRole("textbox", { name: "Note de Martin Camille" });
    const noteLea = screen.getByRole("textbox", { name: "Note de Durand Léa" });
    await user.type(noteMartin, "15");
    await user.type(noteLea, "12,5");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));

    const alerte = screen.getByRole("alert");
    expect(alerte).toHaveTextContent("Si l'écart porte sur le lot, aucune de ses lignes n'est écrite");
    expect(alerte).toHaveTextContent("Si l'écart porte sur une suppression, elle n'est pas faite");
    expect(alerte).toHaveTextContent("Vos saisies sont toujours dans la grille");
    expect(alerte).toHaveTextContent("Martin Camille");
    expect(alerte).toHaveTextContent("Durand Léa — la note n'existe plus");
    expect(alerte).toHaveTextContent("rechargez les valeurs à jour");
    expect(alerte).not.toHaveTextContent(versionDistante);
    expect(screen.queryByText(noteDistante)).not.toBeInTheDocument();
    expect(screen.queryByText(versionDistante)).not.toBeInTheDocument();
    expect(noteMartin).toHaveValue("15");
    expect(noteLea).toHaveValue("12,5");
    expect(noteMartin).toBeEnabled();
    expect(screen.getAllByText("Conflit de version").length).toBeGreaterThan(1);
    noteMartin.focus();
    await user.keyboard("{ArrowDown}");
    expect(noteLea).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Recharger les valeurs à jour" }));
    await user.click(screen.getByRole("button", { name: "Garder mes saisies" }));
    expect(onRecharger).not.toHaveBeenCalled();
    expect(noteMartin).toHaveValue("15");

    onRecharger.mockRejectedValueOnce(new Error("réseau"));
    await user.click(screen.getByRole("button", { name: "Recharger les valeurs à jour" }));
    await user.click(screen.getByRole("button", { name: "Recharger" }));
    expect(onRecharger).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Le rechargement a échoué. Vos saisies sont encore sur cette page.")).toBeInTheDocument();
    expect(noteMartin).toHaveValue("15");

    onRecharger.mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole("button", { name: "Recharger les valeurs à jour" }));
    await user.click(screen.getByRole("button", { name: "Recharger" }));
    expect(onRecharger).toHaveBeenCalledTimes(2);
    rerender(
      <SaisieNotes
        grille={{
          ...initiale,
          lignes: [
            { ...eleves[0], valeur: 9, version: "2026-09-30T11:00:00.000Z" },
            { ...eleves[1], valeur: 11, version: "2026-09-30T11:00:00.000Z" },
          ],
        }}
        onEnregistrer={onEnregistrer}
        onRecharger={onRecharger}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Note de Martin Camille" })).toHaveValue("9,00");
    expect(screen.getByRole("textbox", { name: "Note de Durand Léa" })).toHaveValue("11,00");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(versionDistante)).not.toBeInTheDocument();
  });

  it("envoie la version lue lors d'une suppression et signale le conflit", async () => {
    const user = userEvent.setup();
    const versionDistante = "2026-09-30T12:00:00.000Z";
    const onEnregistrer = vi.fn().mockRejectedValue(
      new ApiError(409, "CONFLIT_VERSION", "Une ou plusieurs notes ont été modifiées. Rechargez avant d'enregistrer.", [], [
        { index: null, noteId: "note-martin", eleveId: "1", evaluationId: "ev", version: versionDistante },
      ]),
    );
    const source = grille();
    render(
      <SaisieNotes
        grille={{
          ...source,
          lignes: [
            { ...eleves[0], valeur: 12, version: "2026-09-30T09:16:00.123Z", noteId: "note-martin" },
            eleves[1],
          ],
        }}
        onEnregistrer={onEnregistrer}
      />,
    );
    const note = screen.getByRole("textbox", { name: "Note de Martin Camille" });
    await user.clear(note);
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onEnregistrer).toHaveBeenCalledWith([
      {
        eleveId: "1",
        valeur: null,
        absent: false,
        commentaire: null,
        supprimer: true,
        version: "2026-09-30T09:16:00.123Z",
        noteId: "note-martin",
      },
    ]);
    const alerte = screen.getByRole("alert");
    expect(alerte).toHaveTextContent("Martin Camille — suppression refusée");
    expect(alerte).toHaveTextContent("Vos saisies sont toujours dans la grille");
    expect(alerte).not.toHaveTextContent(versionDistante);
    expect(note).toHaveValue("");
    expect(note).toBeEnabled();
  });

  it("conserve la saisie si la version est refusée", async () => {
    const user = userEvent.setup();
    const onEnregistrer = vi.fn().mockRejectedValue(
      new ApiError(422, "VALIDATION", "Données invalides.", [{ champ: "lignes.0.version", message: "Version requise." }]),
    );
    render(<SaisieNotes grille={grille()} onEnregistrer={onEnregistrer} />);
    const note = screen.getByRole("textbox", { name: "Note de Martin Camille" });
    await user.type(note, "15");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(note).toHaveValue("15");
    expect(screen.getByRole("alert")).toHaveTextContent("la version de la note est manquante ou illisible");
    expect(screen.getByRole("alert")).toHaveTextContent("Vos saisies sont encore sur cette page");
  });
});

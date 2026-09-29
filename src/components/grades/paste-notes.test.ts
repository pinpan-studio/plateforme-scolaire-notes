import { describe, expect, it } from "vitest";
import { parserCollage } from "@/components/grades/paste-notes";

describe("collage tableur", () => {
  it("lit une colonne de notes et les absents", () => {
    expect(parserCollage("15\n12,5\nAbs\n")).toEqual([
      { saisie: "15", absent: false },
      { saisie: "12,5", absent: false },
      { saisie: "", absent: true },
    ]);
  });

  it("lit la note et le commentaire", () => {
    expect(parserCollage("14\tTravail sérieux")).toEqual([
      { saisie: "14", absent: false, commentaire: "Travail sérieux" },
    ]);
  });
});

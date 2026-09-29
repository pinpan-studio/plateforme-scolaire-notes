import { describe, expect, it } from "vitest";
import { validerNote } from "@/components/grades/validate-note";

const vide = { saisie: "", absent: false, commentaire: "" };

describe("validation d'une note", () => {
  it("refuse une note négative", () => {
    expect(validerNote({ ...vide, saisie: "-1" }, 20)).toBe("La note ne peut pas être négative.");
  });

  it("refuse une note au-dessus du maximum", () => {
    expect(validerNote({ ...vide, saisie: "21" }, 20)).toBe("La note ne peut pas dépasser 20.");
  });

  it("refuse un texte", () => {
    expect(validerNote({ ...vide, saisie: "abc" }, 20)).toBe("Indiquez une note ou cochez Absent.");
  });

  it("accepte une absence et une virgule", () => {
    expect(validerNote({ ...vide, absent: true, saisie: "" }, 20)).toBeNull();
    expect(validerNote({ ...vide, saisie: "14,5" }, 20)).toBeNull();
  });
});

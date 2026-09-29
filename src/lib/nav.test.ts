import { describe, expect, it } from "vitest";
import { liensPourRole } from "@/lib/nav";
import { peutEcrire } from "@/lib/ui-permissions";

describe("navigation par rôle", () => {
  it("cache les utilisateurs et la saisie pour la consultation", () => {
    const liens = liensPourRole("CONSULTATION");
    expect(liens.some((lien) => lien.href === "/utilisateurs")).toBe(false);
    expect(liens.some((lien) => lien.label === "Saisie des notes")).toBe(false);
    expect(liens.some((lien) => lien.href === "/analyses")).toBe(true);
    expect(peutEcrire("CONSULTATION", "note")).toBe(false);
    expect(peutEcrire("CONSULTATION", "eleve")).toBe(false);
  });

  it("donne la saisie à l'enseignant et les comptes à l'admin", () => {
    expect(liensPourRole("ENSEIGNANT").some((lien) => lien.label === "Saisie des notes")).toBe(true);
    expect(liensPourRole("ENSEIGNANT").some((lien) => lien.href === "/utilisateurs")).toBe(false);
    expect(liensPourRole("ADMIN").some((lien) => lien.href === "/utilisateurs")).toBe(true);
    expect(liensPourRole("DIRECTION").some((lien) => lien.href === "/utilisateurs")).toBe(false);
    expect(peutEcrire("DIRECTION", "note")).toBe(false);
    expect(peutEcrire("DIRECTION", "classe")).toBe(true);
  });
});

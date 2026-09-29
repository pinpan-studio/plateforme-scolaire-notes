import { describe, expect, it } from "vitest";
import { formatCoefficient, formatMoyenne, formatRang, libelleCompteur } from "@/lib/format";
import { periodeCourante } from "@/lib/periode";
import type { Periode } from "@/lib/api-client/types";

describe("affichage", () => {
  it("formate les moyennes, coefficients et rangs", () => {
    expect(formatMoyenne(14)).toBe("14,00");
    expect(formatMoyenne(null)).toBe("—");
    expect(formatCoefficient(4)).toBe("4");
    expect(formatCoefficient(1.5)).toBe("1,5");
    expect(formatRang(1, 30)).toBe("1er / 30");
    expect(formatRang(2, 30)).toBe("2e / 30");
    expect(formatRang(null, 30)).toBe("Non classé");
  });

  it("annonce le compteur de recherche", () => {
    expect(libelleCompteur(4, "élève", "élèves", "dupont")).toBe("4 résultats pour « dupont »");
    expect(libelleCompteur(32, "élève", "élèves", "")).toBe("32 élèves");
  });

  it("choisit la période qui contient le jour", () => {
    const periodes: Periode[] = [
      { id: "1", anneeScolaireId: "a", libelle: "Trimestre 1", ordre: 1, dateDebut: "2025-09-01", dateFin: "2025-12-01" },
      { id: "2", anneeScolaireId: "a", libelle: "Trimestre 2", ordre: 2, dateDebut: "2025-12-02", dateFin: "2026-03-15" },
    ];
    expect(periodeCourante(periodes, new Date("2026-01-10T12:00:00Z"))?.id).toBe("2");
    expect(periodeCourante(periodes, new Date("2026-06-01T12:00:00Z"))?.id).toBe("2");
  });
});

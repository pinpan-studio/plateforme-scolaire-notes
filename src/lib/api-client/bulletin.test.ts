import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api-client";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const documentBulletin = {
  eleve: { id: "hugo", matricule: "MAT-1", nom: "Bernard", prenom: "Hugo" },
  classe: { id: "6a", nom: "6e A" },
  periode: { id: "trim-1", libelle: "Trimestre 1" },
  lignes: [
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
  appreciation: "Très insuffisant",
  rang: 13,
  effectif: 14,
  effectifClasse: 14,
};

function installer(routes: (url: string) => Response | null) {
  const appels: string[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo) => {
    const url = String(input);
    appels.push(url);
    const reponse = routes(url);
    if (!reponse) return Promise.resolve(json({ error: { code: "INTROUVABLE", message: "Introuvable." } }, 404));
    return Promise.resolve(reponse);
  });
  return appels;
}

function routesDeBase(appreciation: Response | null) {
  return (url: string) => {
    if (url.startsWith("/api/bulletins")) return json(documentBulletin);
    if (url.startsWith("/api/etablissement")) {
      return json({ id: "etab", nom: "Collège Les Tilleuls", adresse: "1 rue des Écoles", telephone: "", email: "" });
    }
    if (url.startsWith("/api/auth/session")) {
      return json({
        utilisateur: { id: "u", email: "admin@tilleuls.demo", prenom: "A", nom: "Admin", role: "ADMIN", enseignantId: null },
      });
    }
    if (url.startsWith("/api/annees")) return json([]);
    if (url.startsWith("/api/public/etablissement")) return json({ nom: "Collège Les Tilleuls" });
    if (url.startsWith("/api/appreciations-generales")) return appreciation;
    return null;
  };
}

describe("client bulletin", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reprend le rang par matière et le texte libre de l'endpoint existant", async () => {
    const appels = installer(
      routesDeBase(
        json({
          appreciations: [
            { eleveId: "autre", periodeId: "trim-1", texte: "Pas lui." },
            { eleveId: "hugo", periodeId: "trim-1", texte: "  Travail sérieux, à poursuivre.  " },
          ],
        }),
      ),
    );

    const bulletin = await api.bulletin("hugo", { periodeId: "trim-1", anneeId: "annee" });

    expect(bulletin.rang).toBe(13);
    expect(bulletin.effectifClasse).toBe(14);
    expect(bulletin.appreciation).toBe("Très insuffisant");
    expect(bulletin.appreciationGenerale).toBe("Travail sérieux, à poursuivre.");
    expect(bulletin.matieres.map((matiere) => [matiere.nom, matiere.rang, matiere.effectifClasse])).toEqual([
      ["EPS", 11, 14],
      ["Arts", null, 14],
    ]);
    expect(appels.some((url) => url.startsWith("/api/appreciations-generales?"))).toBe(true);
    const appreciation = appels.find((url) => url.startsWith("/api/appreciations-generales"));
    expect(appreciation).toContain("eleveId=hugo");
    expect(appreciation).toContain("periodeId=trim-1");
  });

  it("laisse l'appréciation vide sans période, et si le texte est absent ou interdit", async () => {
    installer(routesDeBase(null));
    const annee = await api.bulletin("hugo", { anneeId: "annee" });
    expect(annee.appreciationGenerale).toBeNull();
    expect(annee.rang).toBe(13);

    installer(routesDeBase(json({ appreciations: [{ eleveId: "hugo", periodeId: "trim-1", texte: "   " }] })));
    const vide = await api.bulletin("hugo", { periodeId: "trim-1" });
    expect(vide.appreciationGenerale).toBeNull();

    installer(routesDeBase(json({ error: { code: "FORBIDDEN", message: "Interdit." } }, 403)));
    const interdit = await api.bulletin("hugo", { periodeId: "trim-1" });
    expect(interdit.appreciationGenerale).toBeNull();
    expect(interdit.matieres[0]?.rang).toBe(11);
  });
});

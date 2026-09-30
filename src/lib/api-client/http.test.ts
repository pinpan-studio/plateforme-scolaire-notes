import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, messageEchecEnregistrement } from "@/lib/api-client/http";

afterEach(() => {
  vi.unstubAllGlobals();
});

function reponse(status: number, corps: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(corps),
  } as Response;
}

describe("messages de refus métier", () => {
  it("affiche error.message tel quel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        reponse(409, {
          error: {
            code: "ELEVE_DEJA_NOTE",
            message: "Impossible de déplacer un élève qui possède déjà des notes.",
          },
        }),
      ),
    );
    await expect(apiFetch("/api/eleves/x", { method: "PATCH", body: "{}" })).rejects.toMatchObject({
      status: 409,
      code: "ELEVE_DEJA_NOTE",
      message: "Impossible de déplacer un élève qui possède déjà des notes.",
    });
  });

  it("retombe sur le texte français du code quand le message est vide", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reponse(403, { error: { code: "REOUVERTURE_INTERDITE", message: " " } })),
    );
    await expect(apiFetch("/api/annees/x", { method: "PATCH", body: "{}" })).rejects.toMatchObject({
      code: "REOUVERTURE_INTERDITE",
      message: "Seule l'administration peut rouvrir une année clôturée.",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reponse(409, { error: { code: "NOTE_MAX_FIGEE", message: "" } })),
    );
    await expect(apiFetch("/api/evaluations/x", { method: "PATCH", body: "{}" })).rejects.toMatchObject({
      code: "NOTE_MAX_FIGEE",
      message: "Impossible de modifier la classe, la matière, la période ou la note maximale tant que des notes existent.",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reponse(409, { error: { code: "EVALUATION_DEJA_NOTEE", message: "" } })),
    );
    await expect(apiFetch("/api/evaluations/x", { method: "PATCH", body: "{}" })).rejects.toMatchObject({
      code: "EVALUATION_DEJA_NOTEE",
      message: "Impossible de modifier la classe, la matière, la période ou la note maximale tant que des notes existent.",
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reponse(403, { error: { code: "FORBIDDEN", message: "" } })),
    );
    await expect(apiFetch("/api/annees/x", { method: "PATCH", body: "{}" })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Action interdite pour ce rôle.",
    });
  });

  it("distingue un refus métier d'un échec réseau", () => {
    expect(messageEchecEnregistrement(new ApiError(403, "FORBIDDEN", "Action interdite pour ce rôle."))).toBe(
      "Action interdite pour ce rôle.",
    );
    expect(messageEchecEnregistrement(new ApiError(0, "RESEAU", "Impossible de charger les données."))).toBe(
      "L'enregistrement a échoué. Vos saisies sont encore sur cette page. Réessayez.",
    );
  });
});

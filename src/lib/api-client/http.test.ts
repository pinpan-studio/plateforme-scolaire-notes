import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "@/lib/api-client/http";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lecture d'un conflit de version", () => {
  it("conserve les identifiants du 409 et ignore une valeur de note ajoutée au corps", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: "CONFLIT_VERSION",
                message: "Une ou plusieurs notes ont été modifiées. Rechargez avant d'enregistrer.",
                conflits: [
                  {
                    index: 1,
                    noteId: "note-1",
                    eleveId: "eleve-1",
                    evaluationId: "eval-1",
                    version: "2026-09-30T09:16:00.456Z",
                    valeur: 8,
                  },
                  {
                    index: null,
                    noteId: null,
                    eleveId: "eleve-2",
                    evaluationId: "eval-1",
                    version: null,
                  },
                ],
              },
            }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const erreur = await apiFetch("/api/notes/lot", { method: "POST", body: "{}" }).then(
      () => null,
      (error: unknown) => error,
    );
    expect(erreur).toBeInstanceOf(ApiError);
    if (!(erreur instanceof ApiError)) {
      return;
    }
    expect(erreur.status).toBe(409);
    expect(erreur.code).toBe("CONFLIT_VERSION");
    expect(erreur.conflits).toEqual([
      {
        index: 1,
        noteId: "note-1",
        eleveId: "eleve-1",
        evaluationId: "eval-1",
        version: "2026-09-30T09:16:00.456Z",
      },
      {
        index: null,
        noteId: null,
        eleveId: "eleve-2",
        evaluationId: "eval-1",
        version: null,
      },
    ]);
    expect(erreur.conflits[0]).not.toHaveProperty("valeur");
  });
});

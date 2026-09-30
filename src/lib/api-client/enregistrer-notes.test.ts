import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api-client";

const MESSAGE = "Trop de tentatives. Réessayez plus tard.";

describe("enregistrement des notes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("arrête l'écriture quand la validation répond 429", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/notes/valider")) {
        return new Response(
          JSON.stringify({ error: { code: "TROP_DE_TENTATIVES", message: MESSAGE } }),
          { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "42" } },
        );
      }
      throw new Error(`appel inattendu ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      api.enregistrerNotes("ev", [
        { eleveId: "eleve", valeur: 12, absent: false, commentaire: null, supprimer: false },
      ]),
    ).rejects.toMatchObject({ status: 429, code: "TROP_DE_TENTATIVES", message: MESSAGE });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

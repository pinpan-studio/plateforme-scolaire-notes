import { describe, expect, it } from "vitest";
import { GET as getEleves } from "@/app/api/eleves/route";
import { POST as postLogin } from "@/app/api/auth/login/route";
import { GET as getSession } from "@/app/api/auth/session/route";
import { GET as getUtilisateurs } from "@/app/api/utilisateurs/route";
import { call, cookiePair, jsonOf, login } from "./helpers";

describe("contrôles de sécurité observables", () => {
  it("ne renvoie ni hachage ni secret dans la session, la connexion et les comptes", async () => {
    const connexion = await call(postLogin, "/api/auth/login", {
      method: "POST",
      body: { email: "admin@tilleuls.demo", motDePasse: "Demo-2026!" },
    });
    const cookie = cookiePair(connexion);
    const session = await call(getSession, "/api/auth/session", { cookie });
    const comptes = await call(getUtilisateurs, "/api/utilisateurs", { cookie });
    for (const response of [connexion, session, comptes]) {
      expect(response.status).toBe(200);
      const texte = JSON.stringify(await jsonOf(response));
      expect(texte).not.toMatch(/motDePasseHash|mot_de_passe_hash|AUTH_SECRET|DATABASE_URL|\$2[ab]\$/);
    }
  });

  it("borne la recherche et refuse une injection dans le filtre", async () => {
    const admin = await login("direction@tilleuls.demo");
    const injection = await call(getEleves, "/api/eleves?q=" + encodeURIComponent("' OR 1=1 --"), {
      cookie: admin,
    });
    expect(injection.status).toBe(200);
    const page = await jsonOf(injection);
    expect(page).toHaveProperty("data");
    expect(JSON.stringify(page)).not.toMatch(/syntax error|motDePasseHash/i);

    for (let essai = 0; essai < 29; essai += 1) {
      const response = await call(getEleves, `/api/eleves?q=a${essai}`, { cookie: admin });
      expect(response.status).toBe(200);
    }
    const bloque = await call(getEleves, "/api/eleves?q=encore", { cookie: admin });
    expect(bloque.status).toBe(429);
    expect(bloque.headers.get("retry-after")).toMatch(/^[1-9]\d*$/);
    expect(await jsonOf(bloque)).toEqual({
      error: { code: "TROP_DE_TENTATIVES", message: "Trop de tentatives. Réessayez plus tard." },
    });
  });
});

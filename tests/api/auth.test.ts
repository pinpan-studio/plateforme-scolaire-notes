import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { GET as sessionRoute } from "@/app/api/auth/session/route";
import { GET as elevesRoute } from "@/app/api/eleves/route";
import { GET as healthRoute } from "@/app/api/health/route";
import { utilisateur } from "@/db/schema";
import { DEMO_PASSWORD, DEMO_PASSWORD_HASH } from "@/db/demo-password";
import { createSessionToken } from "@/lib/auth/session";
import { resetRateLimits } from "@/lib/auth/rate-limit";
import { getDb } from "@/server/db";
import { call, cookiePair, jsonOf, login } from "./helpers";

const ADMIN = "admin@tilleuls.demo";

describe("authentification", () => {
  afterAll(async () => {
    await getDb().update(utilisateur).set({ actif: true }).where(eq(utilisateur.email, "consultation@tilleuls.demo"));
  });

  it("ouvre une session et refuse l'accès anonyme", async () => {
    const anonyme = await call(elevesRoute, "/api/eleves");
    expect(anonyme.status).toBe(401);
    const body = await jsonOf(anonyme);
    expect(JSON.stringify(body)).not.toContain("SELECT");

    const response = await call(loginRoute, "/api/auth/login", {
      method: "POST",
      body: { email: ADMIN, motDePasse: DEMO_PASSWORD },
    });
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=");
    const payload = await jsonOf(response);
    expect(JSON.stringify(payload)).not.toContain("motDePasse");
    expect(JSON.stringify(payload)).not.toContain("$2");

    const cookie = cookiePair(response);
    const session = await call(sessionRoute, "/api/auth/session", { cookie });
    expect(session.status).toBe(200);
    const liste = await call(elevesRoute, "/api/eleves", { cookie });
    expect(liste.status).toBe(200);
  });

  it("renvoie le même refus pour un mot de passe faux et un compte inconnu", async () => {
    const faux = await call(loginRoute, "/api/auth/login", {
      method: "POST",
      body: { email: ADMIN, motDePasse: "mauvais-mot-de-passe" },
    });
    const inconnu = await call(loginRoute, "/api/auth/login", {
      method: "POST",
      body: { email: "inconnu@tilleuls.demo", motDePasse: "mauvais-mot-de-passe" },
    });
    expect(faux.status).toBe(401);
    expect(inconnu.status).toBe(401);
    const fauxBody = await jsonOf(faux);
    const inconnuBody = await jsonOf(inconnu);
    expect(fauxBody).toEqual(inconnuBody);
    expect(faux.headers.get("set-cookie")).toBeNull();
    expect(JSON.stringify(fauxBody)).toContain("Identifiants invalides");
  });

  it("refuse un mot de passe qui est le hachage lui-même", async () => {
    const response = await call(loginRoute, "/api/auth/login", {
      method: "POST",
      body: { email: ADMIN, motDePasse: DEMO_PASSWORD_HASH },
    });
    expect(response.status).toBe(401);
  });

  it("refuse un compte désactivé puis un ancien cookie", async () => {
    await getDb().update(utilisateur).set({ actif: false }).where(eq(utilisateur.email, "consultation@tilleuls.demo"));
    const response = await call(loginRoute, "/api/auth/login", {
      method: "POST",
      body: { email: "consultation@tilleuls.demo", motDePasse: DEMO_PASSWORD },
    });
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();

    const [row] = await getDb()
      .select()
      .from(utilisateur)
      .where(eq(utilisateur.email, "consultation@tilleuls.demo"))
      .limit(1);
    const token = await createSessionToken(
      {
        id: row.id,
        email: row.email,
        role: "CONSULTATION",
        enseignantId: null,
        prenom: row.prenom,
        nom: row.nom,
        sessionVersion: row.sessionVersion,
      },
      { secure: false },
    );
    const replay = await call(elevesRoute, "/api/eleves", { cookie: `authjs.session-token=${token}` });
    expect(replay.status).toBe(401);
    await getDb().update(utilisateur).set({ actif: true }).where(eq(utilisateur.id, row.id));
  });

  it("révoque le cookie à la déconnexion et à la reconnexion", async () => {
    const first = await login(ADMIN);
    const second = await login(ADMIN);
    expect(first).not.toBe(second);
    const ancien = await call(elevesRoute, "/api/eleves", { cookie: first });
    expect(ancien.status).toBe(401);
    const logout = await call(logoutRoute, "/api/auth/logout", { method: "POST", cookie: second });
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    const replay = await call(elevesRoute, "/api/eleves", { cookie: second });
    expect(replay.status).toBe(401);
  });

  it("refuse une session expirée", async () => {
    const cookie = await login(ADMIN);
    const [row] = await getDb().select().from(utilisateur).where(eq(utilisateur.email, ADMIN)).limit(1);
    const token = await createSessionToken(
      {
        id: row.id,
        email: row.email,
        role: "ADMIN",
        enseignantId: null,
        prenom: row.prenom,
        nom: row.nom,
        sessionVersion: row.sessionVersion,
      },
      { secure: false, maxAge: -60 },
    );
    const response = await call(elevesRoute, "/api/eleves", { cookie: `authjs.session-token=${token}` });
    expect(response.status).toBe(401);
    const courant = await call(elevesRoute, "/api/eleves", { cookie });
    expect(courant.status).toBe(200);
  });

  it("limite les essais de connexion", async () => {
    await resetRateLimits();
    const email = "rate.limit@tilleuls.demo";
    for (let essai = 0; essai < 5; essai += 1) {
      const response = await call(loginRoute, "/api/auth/login", {
        method: "POST",
        body: { email, motDePasse: "mauvais-mot-de-passe" },
      });
      expect(response.status).toBe(401);
    }
    const bloque = await call(loginRoute, "/api/auth/login", {
      method: "POST",
      body: { email, motDePasse: DEMO_PASSWORD },
    });
    expect(bloque.status).toBe(429);
    expect(bloque.headers.get("retry-after")).toBeTruthy();
    const autre = await call(loginRoute, "/api/auth/login", {
      method: "POST",
      body: { email: ADMIN, motDePasse: DEMO_PASSWORD },
    });
    expect(autre.status).toBe(200);
  });

  it("refuse une origine hostile", async () => {
    const cookie = await login(ADMIN);
    const response = await call(elevesRoute, "/api/eleves", {
      method: "POST",
      cookie,
      origin: "https://evil.example",
      body: {},
    });
    expect(response.status).toBe(403);
  });

  it("publie les en-têtes de sécurité", async () => {
    const response = await call(healthRoute, "/api/health");
    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("x-powered-by")).toBeNull();
  });
});

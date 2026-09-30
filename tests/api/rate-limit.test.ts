import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as postValider } from "@/app/api/notes/valider/route";
import { PATCH as patchMotDePasse } from "@/app/api/profil/mot-de-passe/route";
import { PATCH as patchUtilisateur } from "@/app/api/utilisateurs/[id]/route";
import { POST as postTemporaire } from "@/app/api/utilisateurs/[id]/mot-de-passe-temporaire/route";
import { GET as getClasses } from "@/app/api/classes/route";
import { GET as getEvaluations } from "@/app/api/evaluations/route";
import { GET as getMatieres } from "@/app/api/matieres/route";
import { GET as getEleves } from "@/app/api/eleves/route";
import { journalAudit, limiteTentative, note, utilisateur } from "@/db/schema";
import { DEMO_PASSWORD, DEMO_PASSWORD_HASHES } from "@/db/demo-password";
import { assertLoginAllowed, recordLoginFailure } from "@/lib/auth/rate-limit";
import { clientIp } from "@/server/http";
import { getDb } from "@/server/db";
import { call, jsonOf, login } from "./helpers";

const ADMIN = "admin@tilleuls.demo";
const DIRECTION = "direction@tilleuls.demo";
const CONSULTATION = "consultation@tilleuls.demo";
const NATHAN = "nathan.durand@tilleuls.demo";
const CAMILLE = "camille.martin@tilleuls.demo";

async function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function echecConnexion(email: string, ip: string) {
  return call(loginRoute, "/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: { email, motDePasse: "mauvais-mot-de-passe" },
  });
}

describe("adresse IP derrière Vercel", () => {
  it("ignore un en-tête client et retombe sur inconnue hors en-tête de confiance", async () => {
    await withEnv({ VERCEL: "1" }, async () => {
      const usurpe = new Request("https://app.example/api/auth/login", {
        headers: { "x-forwarded-for": "203.0.113.9", "x-real-ip": "198.51.100.8" },
      });
      expect(clientIp(usurpe)).toBe("198.51.100.8");
      const seulementForwarded = new Request("https://app.example/api/auth/login", {
        headers: { "x-forwarded-for": "203.0.113.9, 198.51.100.1" },
      });
      expect(clientIp(seulementForwarded)).toBe("inconnue");
      const plateforme = new Request("https://app.example/api/auth/login", {
        headers: {
          "x-forwarded-for": "203.0.113.9",
          "x-vercel-forwarded-for": "2001:db8::10, 198.51.100.1",
        },
      });
      expect(clientIp(plateforme)).toBe("2001:db8::10");
    });

    const repli = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.4", "x-vercel-forwarded-for": "198.51.100.99" },
    });
    expect(clientIp(repli)).toBe("203.0.113.4");
    expect(clientIp(new Request("http://localhost/api/auth/login"))).toBe("inconnue");
    expect(
      clientIp(new Request("http://localhost/api/auth/login", { headers: { "x-forwarded-for": "pas une ip" } })),
    ).toBe("inconnue");
  });
});

describe("limiteur de connexion partagé", () => {
  it("bloque un e-mail sans bloquer un autre compte de la même IP", async () => {
    await withEnv({ AUTH_RATE_LIMIT_EMAIL_MAX: "2", AUTH_RATE_LIMIT_IP_MAX: "30" }, async () => {
      const ip = "198.51.100.10";
      const email = "limite.email@tilleuls.demo";
      expect((await echecConnexion(email, ip)).status).toBe(401);
      expect((await echecConnexion(email, ip)).status).toBe(401);
      const bloque = await call(loginRoute, "/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: { email, motDePasse: DEMO_PASSWORD },
      });
      expect(bloque.status).toBe(429);
      expect(bloque.headers.get("retry-after")).toBeTruthy();
      const corps = await jsonOf(bloque);
      expect(corps).toEqual({
        error: { code: "RATE_LIMITED", message: "Trop de tentatives. Réessayez plus tard." },
      });
      expect(JSON.stringify(corps)).not.toContain(email);
      const autre = await call(loginRoute, "/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: { email: DIRECTION, motDePasse: DEMO_PASSWORD },
      });
      expect(autre.status).toBe(200);
    });
  });

  it("borne une IP sans verrouiller le même e-mail depuis une autre adresse", async () => {
    await withEnv({ AUTH_RATE_LIMIT_EMAIL_MAX: "20", AUTH_RATE_LIMIT_IP_MAX: "3" }, async () => {
      const ip = "198.51.100.20";
      for (const email of ["ip.a@tilleuls.demo", "ip.b@tilleuls.demo", "ip.c@tilleuls.demo"]) {
        expect((await echecConnexion(email, ip)).status).toBe(401);
      }
      const bloque = await echecConnexion("ip.d@tilleuls.demo", ip);
      expect(bloque.status).toBe(429);
      expect(bloque.headers.get("retry-after")).toBeTruthy();
      expect(JSON.stringify(await jsonOf(bloque))).not.toContain("@");
      const autreIp = await echecConnexion("ip.d@tilleuls.demo", "198.51.100.21");
      expect(autreIp.status).toBe(401);
    });
  });

  it("laisse un compte de démo utilisable depuis une autre IP", async () => {
    await withEnv({ AUTH_RATE_LIMIT_EMAIL_MAX: "2", AUTH_RATE_LIMIT_IP_MAX: "30" }, async () => {
      const ipAttaquant = "198.51.100.30";
      expect((await echecConnexion(ADMIN, ipAttaquant)).status).toBe(401);
      expect((await echecConnexion(ADMIN, ipAttaquant)).status).toBe(401);
      const verrouille = await call(loginRoute, "/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": ipAttaquant },
        body: { email: ADMIN, motDePasse: DEMO_PASSWORD },
      });
      expect(verrouille.status).toBe(429);
      const maison = await call(loginRoute, "/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.31" },
        body: { email: ADMIN, motDePasse: DEMO_PASSWORD },
      });
      expect(maison.status).toBe(200);
      const collegue = await call(loginRoute, "/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": ipAttaquant },
        body: { email: DIRECTION, motDePasse: DEMO_PASSWORD },
      });
      expect(collegue.status).toBe(200);
    });
  });

  it("oublie les échecs à la fin de la fenêtre glissante", async () => {
    await withEnv({ AUTH_RATE_LIMIT_EMAIL_MAX: "2", AUTH_RATE_LIMIT_IP_MAX: "30" }, async () => {
      const ip = "198.51.100.40";
      const email = "fenetre@tilleuls.demo";
      await recordLoginFailure(ip, email);
      await recordLoginFailure(ip, email);
      await expect(assertLoginAllowed(ip, email)).rejects.toMatchObject({ status: 429 });

      await getDb().execute(sql`update limite_tentative set created_at = now() - interval '16 minutes'`);
      await expect(assertLoginAllowed(ip, email)).resolves.toBeUndefined();
      expect(await getDb().select({ id: limiteTentative.id }).from(limiteTentative)).toHaveLength(0);

      await recordLoginFailure(ip, email);
      await expect(assertLoginAllowed(ip, email)).resolves.toBeUndefined();
      await recordLoginFailure(ip, email);
      await expect(assertLoginAllowed(ip, email)).rejects.toMatchObject({ status: 429 });

      await getDb().execute(sql`
        update limite_tentative
        set created_at = now() - interval '16 minutes'
        where id = (select id from limite_tentative order by created_at asc limit 1)
      `);
      await expect(assertLoginAllowed(ip, email)).resolves.toBeUndefined();
    });
  });

  it("remet le compteur de l'e-mail à zéro après une connexion réussie", async () => {
    await withEnv({ AUTH_RATE_LIMIT_EMAIL_MAX: "2", AUTH_RATE_LIMIT_IP_MAX: "30" }, async () => {
      const ip = "198.51.100.50";
      expect((await echecConnexion(CONSULTATION, ip)).status).toBe(401);
      const succes = await call(loginRoute, "/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: { email: CONSULTATION, motDePasse: DEMO_PASSWORD },
      });
      expect(succes.status).toBe(200);
      // Sans remise à zéro, le second échec suivant serait déjà un 429.
      expect((await echecConnexion(CONSULTATION, ip)).status).toBe(401);
      expect((await echecConnexion(CONSULTATION, ip)).status).toBe(401);
      expect((await echecConnexion(CONSULTATION, ip)).status).toBe(429);
    });
  });

  it("partage l'état entre deux instances", async () => {
    await withEnv({ AUTH_RATE_LIMIT_EMAIL_MAX: "2", AUTH_RATE_LIMIT_IP_MAX: "30" }, async () => {
      const ip = "198.51.100.60";
      const email = "partage.instance@tilleuls.demo";
      const enfant = spawnSync(
        "npx",
        ["tsx", "tests/api/rate-limit-peer.ts", ip, email, "2"],
        { cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 30_000 },
      );
      expect(enfant.status, enfant.stderr).toBe(0);
      await expect(assertLoginAllowed(ip, email)).rejects.toMatchObject({ status: 429 });
      await expect(assertLoginAllowed("198.51.100.61", email)).resolves.toBeUndefined();
    });
  });
});

describe("changement de mot de passe limité", () => {
  afterAll(async () => {
    await getDb()
      .update(utilisateur)
      .set({ motDePasseHash: DEMO_PASSWORD_HASHES[CONSULTATION] })
      .where(eq(utilisateur.email, CONSULTATION));
  });

  it("borne le changement du profil sans changer le message d'échec", async () => {
    await withEnv({ PASSWORD_RATE_LIMIT_MAX: "2", PASSWORD_RATE_LIMIT_IP_MAX: "30" }, async () => {
      const cookie = await login(ADMIN);
      const ip = "198.51.100.70";
      const corps = {
        motDePasseActuel: "mauvais-mot-de-passe",
        motDePasse: "Un-mot-de-passe-12",
      };
      const premier = await call(patchMotDePasse, "/api/profil/mot-de-passe", {
        method: "PATCH",
        cookie,
        headers: { "x-forwarded-for": ip },
        body: corps,
      });
      const second = await call(patchMotDePasse, "/api/profil/mot-de-passe", {
        method: "PATCH",
        cookie,
        headers: { "x-forwarded-for": ip },
        body: corps,
      });
      expect(premier.status).toBe(403);
      expect(second.status).toBe(403);
      const message = await jsonOf(premier);
      expect(message).toEqual(await jsonOf(second));
      expect(message).toEqual({
        error: { code: "FORBIDDEN", message: "Le mot de passe actuel est requis." },
      });
      const bloque = await call(patchMotDePasse, "/api/profil/mot-de-passe", {
        method: "PATCH",
        cookie,
        headers: { "x-forwarded-for": ip },
        body: { motDePasseActuel: DEMO_PASSWORD, motDePasse: "Un-mot-de-passe-12" },
      });
      expect(bloque.status).toBe(429);
      expect(bloque.headers.get("retry-after")).toBeTruthy();
      expect(await jsonOf(bloque)).toEqual({
        error: { code: "RATE_LIMITED", message: "Trop de tentatives. Réessayez plus tard." },
      });
    });
  });

  it("borne le mot de passe temporaire sans révéler si le compte existe", async () => {
    await withEnv(
      { PASSWORD_RATE_LIMIT_MAX: "10", PASSWORD_RATE_LIMIT_IP_MAX: "2" },
      async () => {
        const cookie = await login(ADMIN);
        const [compte] = await getDb()
          .select({ id: utilisateur.id })
          .from(utilisateur)
          .where(eq(utilisateur.email, CONSULTATION))
          .limit(1);
        const inconnu = "00000000-0000-4000-8000-000000000000";
        const ip = "198.51.100.80";
        const absent = await call(postTemporaire, `/api/utilisateurs/${inconnu}/mot-de-passe-temporaire`, {
          method: "POST",
          cookie,
          params: { id: inconnu },
          headers: { "x-forwarded-for": ip },
        });
        expect(absent.status).toBe(404);
        expect(await jsonOf(absent)).toEqual({
          error: { code: "NOT_FOUND", message: "Utilisateur introuvable." },
        });
        const ok = await call(postTemporaire, `/api/utilisateurs/${compte.id}/mot-de-passe-temporaire`, {
          method: "POST",
          cookie,
          params: { id: compte.id },
          headers: { "x-forwarded-for": ip },
        });
        expect(ok.status).toBe(200);
        const cree = await jsonOf(ok);
        expect(cree).toHaveProperty("motDePasseTemporaire");
        expect(JSON.stringify(cree)).not.toMatch(/motDePasseHash|\$2[ab]\$/);
        const bloqueConnu = await call(postTemporaire, `/api/utilisateurs/${compte.id}/mot-de-passe-temporaire`, {
          method: "POST",
          cookie,
          params: { id: compte.id },
          headers: { "x-forwarded-for": ip },
        });
        const bloqueInconnu = await call(postTemporaire, `/api/utilisateurs/${inconnu}/mot-de-passe-temporaire`, {
          method: "POST",
          cookie,
          params: { id: inconnu },
          headers: { "x-forwarded-for": ip },
        });
        expect(bloqueConnu.status).toBe(429);
        expect(bloqueInconnu.status).toBe(429);
        expect(bloqueConnu.headers.get("retry-after")).toBeTruthy();
        const corpsConnu = await jsonOf(bloqueConnu);
        expect(corpsConnu).toEqual(await jsonOf(bloqueInconnu));
        expect(JSON.stringify(corpsConnu)).not.toMatch(/introuvable|@/);
        const autreIp = await call(postTemporaire, `/api/utilisateurs/${compte.id}/mot-de-passe-temporaire`, {
          method: "POST",
          cookie,
          params: { id: compte.id },
          headers: { "x-forwarded-for": "198.51.100.81" },
        });
        expect(autreIp.status).toBe(200);
      },
    );
  });

  it("borne aussi le changement via la fiche utilisateur", async () => {
    await withEnv({ PASSWORD_RATE_LIMIT_MAX: "2", PASSWORD_RATE_LIMIT_IP_MAX: "30" }, async () => {
      const cookie = await login(ADMIN);
      const [compte] = await getDb()
        .select({ id: utilisateur.id })
        .from(utilisateur)
        .where(eq(utilisateur.email, DIRECTION))
        .limit(1);
      const ip = "198.51.100.90";
      const corps = { motDePasseActuel: "mauvais-mot-de-passe", motDePasse: "Un-mot-de-passe-12" };
      const premier = await call(patchUtilisateur, `/api/utilisateurs/${compte.id}`, {
        method: "PATCH",
        cookie,
        params: { id: compte.id },
        headers: { "x-forwarded-for": ip },
        body: corps,
      });
      const second = await call(patchUtilisateur, `/api/utilisateurs/${compte.id}`, {
        method: "PATCH",
        cookie,
        params: { id: compte.id },
        headers: { "x-forwarded-for": ip },
        body: corps,
      });
      expect(premier.status).toBe(403);
      expect(await jsonOf(premier)).toEqual(await jsonOf(second));
      const bloque = await call(patchUtilisateur, `/api/utilisateurs/${compte.id}`, {
        method: "PATCH",
        cookie,
        params: { id: compte.id },
        headers: { "x-forwarded-for": ip },
        body: corps,
      });
      expect(bloque.status).toBe(429);
      expect(bloque.headers.get("retry-after")).toBeTruthy();
    });
  });
});

async function grilleNathan() {
  const admin = await login(ADMIN);
  const nathan = await login(NATHAN);
  const camille = await login(CAMILLE);
  const classes = await jsonOf(await call(getClasses, "/api/classes?pageSize=100", { cookie: admin }));
  const sixieme = (classes.data as Array<{ id: string; nom: string }>).find((row) => row.nom === "6e A");
  if (!sixieme) throw new Error("Classe de démo absente");
  const matieres = (await jsonOf(await call(getMatieres, "/api/matieres", { cookie: admin }))) as unknown as Array<{
    id: string;
    code: string;
  }>;
  const pc = matieres.find((row) => row.code === "PC");
  if (!pc) throw new Error("Matière absente");
  const evaluations = await jsonOf(
    await call(getEvaluations, `/api/evaluations?classeId=${sixieme.id}&pageSize=100`, { cookie: admin }),
  );
  const evaluation = (evaluations.data as Array<{ id: string; matiereId: string }>).find((row) => row.matiereId === pc.id);
  if (!evaluation) throw new Error("Évaluation absente");
  const eleves = await jsonOf(
    await call(getEleves, `/api/eleves?classeId=${sixieme.id}&pageSize=20`, { cookie: admin }),
  );
  const eleveId = (eleves.data as Array<{ id: string }>)[0]?.id;
  if (!eleveId) throw new Error("Élève absent");
  const [acteur] = await getDb()
    .select({ id: utilisateur.id })
    .from(utilisateur)
    .where(eq(utilisateur.email, NATHAN))
    .limit(1);
  return { nathan, camille, evaluationId: evaluation.id, eleveId, acteurId: acteur.id };
}

function corpsValidation(evaluationId: string, eleveId: string, valeur: number) {
  return {
    evaluationId,
    lignes: [{ eleveId, valeur, estAbsent: false }],
  };
}

async function validationsDe(acteurId: string) {
  return getDb()
    .select({ id: journalAudit.id })
    .from(journalAudit)
    .where(and(eq(journalAudit.type, "NOTE_VALIDATION"), eq(journalAudit.acteurId, acteurId)));
}

describe("validation des notes", () => {
  it("n'audite qu'un changement d'état et reste sans écriture de note", async () => {
    const ctx = await grilleNathan();
    const avantNotes = await getDb().select({ id: note.id }).from(note).where(eq(note.evaluationId, ctx.evaluationId));
    const avantAudit = (await validationsDe(ctx.acteurId)).length;
    const ip = "198.51.100.100";
    const appel = (valeur: number) =>
      call(postValider, "/api/notes/valider", {
        method: "POST",
        cookie: ctx.nathan,
        headers: { "x-forwarded-for": ip },
        body: corpsValidation(ctx.evaluationId, ctx.eleveId, valeur),
      });
    expect((await appel(15)).status).toBe(200);
    expect((await appel(15)).status).toBe(200);
    expect((await validationsDe(ctx.acteurId)).length).toBe(avantAudit + 1);
    expect((await appel(16)).status).toBe(200);
    expect((await appel(16)).status).toBe(200);
    expect((await validationsDe(ctx.acteurId)).length).toBe(avantAudit + 2);
    const apresNotes = await getDb().select({ id: note.id }).from(note).where(eq(note.evaluationId, ctx.evaluationId));
    expect(apresNotes).toHaveLength(avantNotes.length);
  });

  it("borne la validation par utilisateur et par IP", async () => {
    await withEnv(
      { VALIDATION_RATE_LIMIT_MAX: "2", VALIDATION_RATE_LIMIT_IP_MAX: "20", VALIDATION_RATE_LIMIT_WINDOW_SECONDS: "60" },
      async () => {
        const ctx = await grilleNathan();
        const ip = "198.51.100.110";
        const appel = (cookie: string, adresse: string) =>
          call(postValider, "/api/notes/valider", {
            method: "POST",
            cookie,
            headers: { "x-forwarded-for": adresse },
            body: corpsValidation(ctx.evaluationId, ctx.eleveId, 12),
          });
        expect((await appel(ctx.nathan, ip)).status).toBe(200);
        expect((await appel(ctx.nathan, ip)).status).toBe(200);
        const bloque = await appel(ctx.nathan, ip);
        expect(bloque.status).toBe(429);
        expect(bloque.headers.get("retry-after")).toBeTruthy();
        expect(await jsonOf(bloque)).toEqual({
          error: { code: "RATE_LIMITED", message: "Trop de tentatives. Réessayez plus tard." },
        });
        const autreIp = await appel(ctx.nathan, "198.51.100.111");
        expect(autreIp.status).toBe(429);
        const collegue = await appel(ctx.camille, "198.51.100.112");
        expect(collegue.status).toBe(403);
      },
    );

    await withEnv(
      { VALIDATION_RATE_LIMIT_MAX: "20", VALIDATION_RATE_LIMIT_IP_MAX: "2", VALIDATION_RATE_LIMIT_WINDOW_SECONDS: "60" },
      async () => {
        const ctx = await grilleNathan();
        const ip = "198.51.100.120";
        const appel = (adresse: string) =>
          call(postValider, "/api/notes/valider", {
            method: "POST",
            cookie: ctx.nathan,
            headers: { "x-forwarded-for": adresse },
            body: corpsValidation(ctx.evaluationId, ctx.eleveId, 11),
          });
        expect((await appel(ip)).status).toBe(200);
        expect((await appel(ip)).status).toBe(200);
        const bloque = await appel(ip);
        expect(bloque.status).toBe(429);
        expect(bloque.headers.get("retry-after")).toBeTruthy();
        expect((await appel("198.51.100.121")).status).toBe(200);
      },
    );
  });
});

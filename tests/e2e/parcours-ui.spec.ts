import { expect, test, type Page } from "@playwright/test";

async function connecter(page: Page) {
  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill("admin@tilleuls.demo");
  await page.getByLabel("Mot de passe").fill("Demo-2026!");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour Alex" })).toBeVisible();
}

test("connexion puis tableau de bord", async ({ page }) => {
  await connecter(page);
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
});

test("consultation des résultats", async ({ page }) => {
  await connecter(page);
  await page.goto("/resultats");
  await expect(page.getByRole("heading", { name: "Résultats" })).toBeVisible();
});

test("saisie rapide d'une note", async ({ page }) => {
  await connecter(page);
  const liste = await page.request.get("/api/evaluations?pageSize=5");
  expect(liste.ok()).toBeTruthy();
  const corps = (await liste.json()) as { data: Array<{ id: string }> };
  expect(corps.data.length).toBeGreaterThan(0);
  await page.goto(`/evaluations/${corps.data[0].id}/notes`);
  await expect(page.getByRole("heading", { name: "Saisie des notes" })).toBeVisible();
  const champ = page.getByLabel(/^Note de /).first();
  const actuel = await champ.inputValue();
  await champ.fill(actuel.startsWith("13") ? "14" : "13");
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeEnabled();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Notes enregistrées.")).toBeVisible();
});

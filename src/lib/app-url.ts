/** Origine canonique. `APP_URL` prime ; `AUTH_URL` est l'alias Auth.js. */
export function configuredAppUrl(): string | null {
  const raw = process.env.APP_URL || process.env.AUTH_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function appUsesHttps(): boolean {
  const raw = process.env.APP_URL || process.env.AUTH_URL || "";
  return raw.startsWith("https://");
}

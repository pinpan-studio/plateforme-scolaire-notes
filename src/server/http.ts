import { configuredAppUrl } from "@/lib/app-url";
import { HSTS, securityHeaders } from "@/lib/security-headers";
import { ApiError, fromDatabase, toErrorBody } from "./errors";

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders())) {
    if (!headers.has(name)) headers.set(name, value);
  }
  if (process.env.NODE_ENV === "production" && !headers.has("Strict-Transport-Security")) {
    headers.set("Strict-Transport-Security", HSTS);
  }
  headers.delete("X-Powered-By");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function json(body: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return withSecurityHeaders(new Response(JSON.stringify(body), { status, headers }));
}

export function empty(status = 204, extra?: HeadersInit): Response {
  return withSecurityHeaders(new Response(null, { status, headers: extra }));
}

const IP_PATTERN = /^[0-9a-fA-F:.]+$/;

function firstValidIp(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const candidate = part.trim();
    if (candidate.length > 0 && candidate.length <= 64 && IP_PATTERN.test(candidate)) {
      return candidate.toLowerCase();
    }
  }
  return null;
}

/**
 * Adresse IP du client, pour l'audit et les limites de tentatives.
 *
 * Sur Vercel (`VERCEL` défini), seuls les en-têtes posés par la plateforme
 * sont lus, dans cet ordre : `x-vercel-forwarded-for`, puis `x-real-ip`.
 * Vercel les écrase. `x-forwarded-for` est ignoré : un client peut le
 * préfixer, et un proxy de confiance Enterprise peut le relayer.
 * La première adresse syntaxiquement valide de l'en-tête de confiance est
 * retenue (Vercel place le client en tête).
 *
 * Hors Vercel (développement et tests, sans proxy de confiance), repli :
 * première adresse valide de `x-forwarded-for`. Ce repli n'est pas une
 * preuve d'identité ; les en-têtes `x-vercel-forwarded-for` et `x-real-ip`
 * y sont ignorés pour qu'un client ne choisisse pas son seau. S'il n'y a
 * aucune adresse valide, la clé est `inconnue` : ces requêtes partagent
 * un même compteur.
 */
export function clientIp(request: Request): string {
  if (process.env.VERCEL) {
    return (
      firstValidIp(request.headers.get("x-vercel-forwarded-for")) ??
      firstValidIp(request.headers.get("x-real-ip")) ??
      "inconnue"
    );
  }
  return firstValidIp(request.headers.get("x-forwarded-for")) ?? "inconnue";
}

function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const configured = configuredAppUrl();
  if (configured) origins.add(configured);
  const host = request.headers.get("host");
  if (host && /^[a-zA-Z0-9.:-]+$/.test(host)) {
    origins.add(`http://${host}`);
    origins.add(`https://${host}`);
  }
  return origins;
}

export function assertSameOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return;
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError(403, "CSRF", "Origine refusée.");
  }
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (!allowedOrigins(request).has(origin)) {
    throw new ApiError(403, "CSRF", "Origine refusée.");
  }
}

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, "JSON_INVALIDE", "Le corps de la requête n'est pas du JSON valide.");
  }
}

function logServerError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : undefined;
  console.error(JSON.stringify({ event: "api_error", name: error instanceof Error ? error.name : "unknown", code }));
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    const headers = new Headers();
    if (error.retryAfter) headers.set("Retry-After", String(error.retryAfter));
    return json(toErrorBody(error), error.status, headers);
  }
  const mapped = fromDatabase(error);
  if (mapped) return json(toErrorBody(mapped), mapped.status);
  logServerError(error);
  return json(
    { error: { code: "ERREUR_INTERNE", message: "Une erreur interne est survenue." } },
    500,
  );
}

type RouteContext = { params: Record<string, string> };

export function route(
  handler: (request: Request, context: RouteContext) => Promise<Response>,
) {
  return async (request: Request, raw?: { params?: Promise<Record<string, string>> }) => {
    try {
      assertSameOrigin(request);
      const params = raw?.params ? await raw.params : {};
      return await handler(request, { params });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

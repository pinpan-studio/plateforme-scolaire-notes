import { HSTS, SECURITY_HEADERS } from "@/lib/security-headers";
import { ApiError, fromDatabase, toErrorBody } from "./errors";

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
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

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnue";
  if (!/^[0-9a-fA-F:.]+$/.test(candidate) || candidate.length > 64) return "inconnue";
  return candidate;
}

function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  if (process.env.APP_URL) {
    try {
      origins.add(new URL(process.env.APP_URL).origin);
    } catch {
      // APP_URL invalide : aucune origine supplémentaire.
    }
  }
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

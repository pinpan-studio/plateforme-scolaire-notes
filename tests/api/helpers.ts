import { DEMO_PASSWORD } from "@/db/demo-password";
import { POST as loginRoute } from "@/app/api/auth/login/route";

export const ORIGIN = "http://localhost:3000";

export function cookiePair(response: Response): string {
  const raw = response.headers.get("set-cookie");
  if (!raw) throw new Error("Cookie de session absent");
  return raw.split(";")[0] ?? raw;
}

export async function login(email: string, motDePasse = DEMO_PASSWORD): Promise<string> {
  const response = await loginRoute(
    new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, motDePasse }),
    }),
  );
  if (response.status !== 200) {
    throw new Error(`Connexion ${email} refusée : ${response.status} ${await response.text()}`);
  }
  return cookiePair(response);
}

export async function call(
  handler: (request: Request, context?: { params?: Promise<Record<string, string>> }) => Promise<Response>,
  path: string,
  options: {
    method?: string;
    cookie?: string;
    body?: unknown;
    rawBody?: string;
    origin?: string | null;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
) {
  const headers = new Headers(options.headers);
  if (options.origin !== null) headers.set("origin", options.origin ?? ORIGIN);
  if (options.cookie) headers.set("cookie", options.cookie);
  let body: string | undefined;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers.set("content-type", "application/json");
  }
  return handler(new Request(`${ORIGIN}${path}`, { method: options.method ?? "GET", headers, body }), {
    params: Promise.resolve(options.params ?? {}),
  });
}

export async function jsonOf(response: Response) {
  const text = await response.text();
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}

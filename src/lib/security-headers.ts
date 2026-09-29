/**
 * En-têtes communs aux pages et aux réponses JSON.
 * `style-src 'unsafe-inline'` couvre le CSS injecté par Next.js.
 * En production les scripts restent limités à l'origine : pas de `unsafe-eval`, pas de `script-src *`.
 * Le serveur de développement de Next.js a besoin de `unsafe-eval` pour hydrater les pages.
 */
export function contentSecurityPolicy(nonce?: string): string {
  const dev = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev}`
    : `script-src 'self'${dev}`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": contentSecurityPolicy(),
    "Cache-Control": "private, no-store",
  };
}

export const HSTS = "max-age=15552000; includeSubDomains";

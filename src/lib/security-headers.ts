/**
 * En-têtes communs aux pages et aux réponses JSON.
 * `style-src 'unsafe-inline'` couvre le CSS injecté par Next.js.
 * Les scripts restent limités à l'origine : pas de `unsafe-eval`, pas de `script-src *`.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "Cache-Control": "private, no-store",
};

export const HSTS = "max-age=15552000; includeSubDomains";

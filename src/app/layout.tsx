import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

/** Rendu à la demande : le nonce CSP doit être posé sur les scripts de chaque réponse. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Cahier de notes",
    template: "%s — Cahier de notes",
  },
  description: "Saisie, consultation et analyse des notes des élèves.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

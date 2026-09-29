"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import type { Session } from "@/lib/api-client/types";
import { groupesPourRole, LIEN_TABLEAU, libelleRole } from "@/lib/nav";
import { libelleAnnee } from "@/lib/labels";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ToastProvider } from "@/components/ui/toast";
import { SessionProvider, useSession } from "@/components/layout/session";

function Menu({ ouvert, onNaviguer }: { ouvert: boolean; onNaviguer: () => void }) {
  const router = useRouter();
  const { session } = useSession();
  const groupes = groupesPourRole(session.utilisateur.role);

  return (
    <nav aria-label="Navigation principale" className={ouvert ? "block" : "hidden lg:block"}>
      <a href={LIEN_TABLEAU.href} onClick={onNaviguer} className="mb-2 block rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-slate-100">
        {LIEN_TABLEAU.label}
      </a>
      {groupes.map((groupe) => (
        <div key={groupe.label} className="mt-4">
          <p className="px-3 text-xs font-semibold tracking-wide text-muted uppercase">{groupe.label}</p>
          <ul className="mt-1">
            {groupe.liens.map((lien) => (
              <li key={lien.href}>
                <a href={lien.href} onClick={onNaviguer} className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-slate-100">
                  {lien.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <button
        type="button"
        className="mt-6 px-3 text-sm text-danger"
        onClick={() => {
          void api.deconnexion().finally(() => {
            router.push("/connexion");
          });
        }}
      >
        Se déconnecter
      </button>
    </nav>
  );
}

function Cadre({ children }: { children: React.ReactNode }) {
  const { session, annee, anneeId, choisirAnnee } = useSession();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [menuMasque, setMenuMasque] = useState(false);

  return (
    <div className="min-h-screen">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-card focus:p-2">
        Aller au contenu
      </a>
      <header className="app-chrome border-b border-border bg-card print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-2 text-sm lg:hidden"
              aria-expanded={menuOuvert}
              onClick={() => setMenuOuvert((ouvert) => !ouvert)}
            >
              {menuOuvert ? "Fermer le menu" : "Ouvrir le menu"}
            </button>
            <p className="text-sm text-ink">
              {session.utilisateur.prenom} {session.utilisateur.nom}
              <span className="text-muted"> · {libelleRole(session.utilisateur.role)}</span>
            </p>
          </div>
          <label className="text-sm font-medium text-ink">
            Année scolaire
            <select
              className="ml-2 rounded-lg border-2 border-border bg-card px-2 py-1 focus-visible:border-primary focus-visible:outline-none"
              value={anneeId ?? ""}
              onChange={(event) => choisirAnnee(event.target.value)}
            >
              {session.annees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.libelle} ({libelleAnnee(item.statut)})
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <div className="flex">
        <aside className={`app-chrome w-64 shrink-0 border-r border-border bg-card p-3 print:hidden ${menuMasque ? "hidden" : "hidden lg:block"} ${menuOuvert ? "!block" : ""}`}>
          <Menu ouvert onNaviguer={() => setMenuOuvert(false)} />
          <button type="button" className="mt-4 hidden px-3 text-sm text-muted lg:inline" onClick={() => setMenuMasque(true)}>
            Masquer le menu
          </button>
        </aside>
        <main id="contenu" className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          {menuMasque ? (
            <button type="button" className="app-chrome mb-4 text-sm text-primary print:hidden" onClick={() => setMenuMasque(false)}>
              Afficher le menu
            </button>
          ) : null}
          {annee?.statut === "CLOTUREE" ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-warning">Année clôturée.</p>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    api.session().then(
      (valeur) => {
        if (!annule) {
          setSession(valeur);
        }
      },
      (error: unknown) => {
        if (annule) {
          return;
        }
        if (error instanceof ApiError && (error.status === 401 || error.code === "NON_AUTHENTIFIE" || error.code === "SESSION_EXPIREE")) {
          const motif = error.code === "SESSION_EXPIREE" ? "?motif=session" : "";
          router.push(`/connexion${motif}`);
          return;
        }
        setErreur("Impossible de charger les données.");
      },
    );
    return () => {
      annule = true;
    };
  }, [router]);

  if (erreur) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <p role="alert" className="text-sm text-danger">{erreur}</p>
        <button type="button" className="mt-3 text-sm text-primary" onClick={() => window.location.reload()}>
          Réessayer
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <PageSkeleton />
      </div>
    );
  }

  return (
    <SessionProvider session={session}>
      <ToastProvider>
        <Cadre>{children}</Cadre>
      </ToastProvider>
    </SessionProvider>
  );
}

export function GardeRole({ roles, children }: { roles: Session["utilisateur"]["role"][]; children: React.ReactNode }) {
  const { session } = useSession();
  if (roles.includes(session.utilisateur.role)) {
    return children;
  }
  return (
    <div>
      <h1 className="text-2xl font-semibold">Accès refusé</h1>
      <p className="mt-2 text-sm text-muted">Cette action n’est pas disponible pour votre rôle.</p>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-primary">
        Retour au tableau de bord
      </Link>
    </div>
  );
}

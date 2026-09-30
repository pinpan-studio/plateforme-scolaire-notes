"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { useApiData } from "@/components/data/use-api-data";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/fields";

export function ConnexionPage() {
  const router = useRouter();
  const params = useSearchParams();
  const etablissement = useApiData("etablissement-public", () => api.etablissementPublic(), { authentifie: false });
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const sessionExpiree = params.get("motif") === "session";

  async function soumettre() {
    const suivants: Record<string, string> = {};
    if (!email.trim()) suivants.email = "Indiquez un e-mail.";
    if (!motDePasse) suivants.motDePasse = "Indiquez un mot de passe.";
    setErreurs(suivants);
    setErreur(null);
    if (Object.keys(suivants).length > 0) return;
    setBusy(true);
    try {
      await api.connexion(email.trim(), motDePasse);
      router.push("/");
    } catch (error) {
      if (error instanceof ApiError && error.code === "COMPTE_DESACTIVE") {
        setErreur("Ce compte est désactivé. Contactez l'administration.");
      } else if (error instanceof ApiError && error.status === 401) {
        setErreur("E-mail ou mot de passe incorrect.");
      } else if (error instanceof ApiError && error.status === 429) {
        setErreur(error.message);
      } else if (error instanceof ApiError && error.message) {
        setErreur(error.message);
      } else {
        setErreur("Impossible de charger les données.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void soumettre();
        }}
      >
        <p className="text-sm font-medium text-primary">{etablissement.data?.nom ?? "Cahier de notes"}</p>
        <h1 className="text-2xl font-semibold">Connexion</h1>
        {sessionExpiree ? <Banner ton="warning">Votre session a expiré. Reconnectez-vous.</Banner> : null}
        {erreur ? <Banner ton="danger">{erreur}</Banner> : null}
        <TextField id="email" label="E-mail" type="email" autoComplete="username" obligatoire erreur={erreurs.email} value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField id="motDePasse" label="Mot de passe" type="password" autoComplete="current-password" obligatoire erreur={erreurs.motDePasse} value={motDePasse} onChange={(event) => setMotDePasse(event.target.value)} />
        <Button type="submit" busy={busy} className="w-full">
          Se connecter
        </Button>
      </form>
    </main>
  );
}

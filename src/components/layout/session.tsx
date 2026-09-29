"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Annee, Session } from "@/lib/api-client/types";

const CLE_ANNEE = "cahier.anneeId";

type Valeur = {
  session: Session;
  anneeId: string | null;
  annee: Annee | null;
  choisirAnnee: (id: string) => void;
};

const Contexte = createContext<Valeur | null>(null);

export function SessionProvider({ session, children }: { session: Session; children: React.ReactNode }) {
  const [anneeId, setAnneeId] = useState<string | null>(session.anneeActive?.id ?? session.annees[0]?.id ?? null);

  useEffect(() => {
    const memorisee = window.localStorage.getItem(CLE_ANNEE);
    if (memorisee && session.annees.some((annee) => annee.id === memorisee)) {
      // La préférence n'existe que dans le navigateur, après l'hydratation.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage
      setAnneeId(memorisee);
    }
  }, [session.annees]);

  const valeur = useMemo<Valeur>(() => {
    const annee = session.annees.find((item) => item.id === anneeId) ?? session.anneeActive;
    return {
      session,
      anneeId: annee?.id ?? null,
      annee,
      choisirAnnee: (id: string) => {
        window.localStorage.setItem(CLE_ANNEE, id);
        setAnneeId(id);
      },
    };
  }, [anneeId, session]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useSession(): Valeur {
  const valeur = useContext(Contexte);
  if (!valeur) {
    throw new Error("Session absente");
  }
  return valeur;
}

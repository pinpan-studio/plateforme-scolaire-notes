"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, messageUtilisateur, raisonInterdit } from "@/lib/api-client";

type Etat<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  code: string | null;
};

export function useDelai(actif: boolean, delai = 300): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!actif) {
      return;
    }
    const id = window.setTimeout(() => setVisible(true), delai);
    return () => window.clearTimeout(id);
  }, [actif, delai]);
  if (!actif) {
    return false;
  }
  return visible;
}

export function useApiData<T>(
  cle: string,
  charger: () => Promise<T>,
  options?: { interdit?: "rediriger" | "inline"; authentifie?: boolean },
) {
  const router = useRouter();
  const chargerRef = useRef(charger);
  useEffect(() => {
    chargerRef.current = charger;
  });
  const [tentative, setTentative] = useState(0);
  const [etat, setEtat] = useState<Etat<T>>({ data: null, error: null, loading: true, code: null });

  useEffect(() => {
    let annule = false;
    // Le chargement suit la requête : l'état ne peut pas être dérivé avant la réponse.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec fetch
    setEtat((actuel) => ({ ...actuel, loading: true, error: null, code: null }));
    chargerRef.current().then(
      (data) => {
        if (!annule) {
          setEtat({ data, error: null, loading: false, code: null });
        }
      },
      (error: unknown) => {
        if (annule) {
          return;
        }
        if (options?.authentifie !== false && error instanceof ApiError && (error.status === 401 || error.code === "SESSION_EXPIREE")) {
          router.push("/connexion?motif=session");
          return;
        }
        if (error instanceof ApiError && error.status === 403 && options?.interdit !== "inline") {
          router.push(`/403?raison=${raisonInterdit(error.code)}`);
          return;
        }
        setEtat({
          data: null,
          error: messageUtilisateur(error),
          loading: false,
          code: error instanceof ApiError ? error.code : null,
        });
      },
    );
    return () => {
      annule = true;
    };
  }, [cle, tentative, options?.interdit, options?.authentifie, router]);

  return {
    ...etat,
    retry: () => setTentative((valeur) => valeur + 1),
    remplacer: (data: T) => setEtat({ data, error: null, loading: false, code: null }),
  };
}

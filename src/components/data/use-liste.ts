"use client";

import { useEffect, useState } from "react";
import type { ListeParams } from "@/lib/api-client/types";

type Tri = { key: string; ordre: "asc" | "desc" };

export function useListe(anneeId: string | null, filtres: ListeParams = {}) {
  const [recherche, setRecherche] = useState("");
  const [differee, setDifferee] = useState("");
  const [page, setPage] = useState(1);
  const [tri, setTri] = useState<Tri | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDifferee(recherche), 300);
    return () => window.clearTimeout(id);
  }, [recherche]);

  const empreinte = `${anneeId ?? ""}|${differee}|${JSON.stringify(filtres)}`;
  const [empreinteVue, setEmpreinteVue] = useState(empreinte);
  if (empreinte !== empreinteVue) {
    setEmpreinteVue(empreinte);
    if (page !== 1) {
      setPage(1);
    }
  }

  function changerTri(cle: string) {
    setTri((actuel) => {
      if (!actuel || actuel.key !== cle) {
        return { key: cle, ordre: "asc" };
      }
      return { key: cle, ordre: actuel.ordre === "asc" ? "desc" : "asc" };
    });
    setPage(1);
  }

  const params: ListeParams = {
    anneeId,
    q: differee || undefined,
    page,
    pageSize: 25,
    tri: tri?.key,
    ordre: tri?.ordre,
    ...filtres,
  };

  return { recherche, setRecherche, page, setPage, tri, changerTri, params, cle: JSON.stringify(params) };
}

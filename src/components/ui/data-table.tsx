"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, type FiltreActif } from "@/components/ui/filter-bar";
import { libelleCompteur } from "@/lib/format";

export type Colonne<T> = {
  key: string;
  entete: string;
  triable?: boolean;
  cellule: (ligne: T) => ReactNode;
  valeurTri?: (ligne: T) => string | number;
};

type Tri = { key: string; ordre: "asc" | "desc" };

type Props<T> = {
  lignes: T[];
  colonnes: Colonne<T>[];
  getId: (ligne: T) => string;
  texteRecherche: (ligne: T) => string;
  hrefLigne?: (ligne: T) => string;
  singulier: string;
  pluriel: string;
  titreVide: string;
  actionVide?: ReactNode;
  pastilles?: FiltreActif[];
  onReinitialiserFiltres?: () => void;
  filtres?: ReactNode;
  pageSize?: number;
  mode?: "interne" | "externe";
  recherche?: string;
  onRecherche?: (valeur: string) => void;
  tri?: Tri | null;
  onTri?: (cle: string) => void;
  page?: number;
  total?: number;
  onPage?: (page: number) => void;
};

export function DataTable<T>({
  lignes,
  colonnes,
  getId,
  texteRecherche,
  hrefLigne,
  singulier,
  pluriel,
  titreVide,
  actionVide,
  pastilles = [],
  onReinitialiserFiltres,
  filtres,
  pageSize = 25,
  mode = "interne",
  recherche: rechercheExterne,
  onRecherche,
  tri: triExterne,
  onTri,
  page: pageExterne,
  total: totalExterne,
  onPage,
}: Props<T>) {
  const router = useRouter();
  const [rechercheInterne, setRechercheInterne] = useState("");
  const [triInterne, setTriInterne] = useState<Tri | null>(null);
  const [pageInterne, setPageInterne] = useState(1);

  const externe = mode === "externe";
  const recherche = externe ? (rechercheExterne ?? "") : rechercheInterne;
  const tri = externe ? (triExterne ?? null) : triInterne;
  const page = externe ? (pageExterne ?? 1) : pageInterne;

  const filtrees = useMemo(() => {
    if (externe) {
      return lignes;
    }
    const terme = recherche.trim().toLowerCase();
    const base = terme ? lignes.filter((ligne) => texteRecherche(ligne).toLowerCase().includes(terme)) : lignes;
    if (!tri) {
      return base;
    }
    const colonne = colonnes.find((item) => item.key === tri.key);
    const copie = [...base];
    copie.sort((a, b) => {
      const va = colonne?.valeurTri?.(a) ?? "";
      const vb = colonne?.valeurTri?.(b) ?? "";
      const comparaison = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "fr");
      return tri.ordre === "asc" ? comparaison : -comparaison;
    });
    return copie;
  }, [colonnes, externe, lignes, recherche, texteRecherche, tri]);

  const total = externe ? (totalExterne ?? lignes.length) : filtrees.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageCourante = Math.min(page, pages);
  const visibles = externe ? lignes : filtrees.slice((pageCourante - 1) * pageSize, pageCourante * pageSize);
  const compteur = libelleCompteur(total, singulier, pluriel, recherche);

  function changerRecherche(valeur: string) {
    if (externe) {
      onRecherche?.(valeur);
      return;
    }
    setRechercheInterne(valeur);
    setPageInterne(1);
  }

  function changerTri(cle: string) {
    if (externe) {
      onTri?.(cle);
      return;
    }
    setTriInterne((actuel) => {
      if (!actuel || actuel.key !== cle) {
        return { key: cle, ordre: "asc" };
      }
      return { key: cle, ordre: actuel.ordre === "asc" ? "desc" : "asc" };
    });
  }

  function changerPage(suivante: number) {
    if (externe) {
      onPage?.(suivante);
      return;
    }
    setPageInterne(suivante);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block min-w-64 flex-1 text-sm font-medium text-ink">
          Rechercher
          <span className="relative mt-1 block">
            <input
              value={recherche}
              onChange={(event) => changerRecherche(event.target.value)}
              className="w-full rounded-lg border-2 border-border bg-card px-3 py-2 pr-16 text-base focus-visible:border-primary focus-visible:outline-none"
            />
            {recherche ? (
              <button
                type="button"
                onClick={() => changerRecherche("")}
                className="absolute top-1/2 right-2 -translate-y-1/2 text-sm text-primary"
              >
                Effacer
              </button>
            ) : null}
          </span>
        </label>
        <p className="text-sm text-muted" aria-live="polite">
          {compteur}
        </p>
      </div>
      <FilterBar pastilles={pastilles} onReinitialiser={onReinitialiserFiltres}>
        {filtres}
      </FilterBar>
      {visibles.length === 0 ? (
        <EmptyState
          titre={recherche.trim() || pastilles.length > 0 ? "Aucun résultat. Modifiez ou réinitialisez les filtres." : titreVide}
          action={actionVide}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-card lg:block">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-card">
                <tr>
                  {colonnes.map((colonne) => {
                    const actif = tri?.key === colonne.key;
                    const ordre = actif ? tri?.ordre : undefined;
                    return (
                      <th key={colonne.key} scope="col" aria-sort={ordre === "asc" ? "ascending" : ordre === "desc" ? "descending" : "none"} className="border-b border-border px-3 py-2 text-left font-medium">
                        {colonne.triable ? (
                          <button
                            type="button"
                            onClick={() => changerTri(colonne.key)}
                            className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            aria-label={actif ? `${colonne.entete}, tri ${ordre === "asc" ? "croissant" : "décroissant"}` : `Trier par ${colonne.entete}`}
                          >
                            {colonne.entete}
                          </button>
                        ) : (
                          colonne.entete
                        )}
                      </th>
                    );
                  })}
                  {hrefLigne ? (
                    <th scope="col" className="border-b border-border px-3 py-2 text-left font-medium">
                      <span className="sr-only">Action</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visibles.map((ligne) => {
                  const href = hrefLigne?.(ligne);
                  return (
                    <tr
                      key={getId(ligne)}
                      className={href ? "cursor-pointer border-b border-border last:border-b-0 hover:bg-slate-50" : "border-b border-border last:border-b-0"}
                      onClick={href ? () => router.push(href) : undefined}
                    >
                      {colonnes.map((colonne) => (
                        <td key={colonne.key} className="px-3 py-2">
                          {colonne.cellule(ligne)}
                        </td>
                      ))}
                      {href ? (
                        <td className="px-3 py-2">
                          <a
                            href={href}
                            className="font-medium text-primary"
                            onClick={(event) => event.stopPropagation()}
                          >
                            Ouvrir
                          </a>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 lg:hidden">
            {visibles.map((ligne) => {
              const href = hrefLigne?.(ligne);
              return (
                <li key={getId(ligne)} className="rounded-lg border border-border bg-card p-3 text-sm">
                  {colonnes.map((colonne) => (
                    <p key={colonne.key} className="flex justify-between gap-3 py-1">
                      <span className="text-muted">{colonne.entete}</span>
                      <span className="text-right">{colonne.cellule(ligne)}</span>
                    </p>
                  ))}
                  {href ? (
                    <a href={href} className="mt-2 inline-block font-medium text-primary">
                      Ouvrir
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {total > pageSize ? (
            <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
              <button
                type="button"
                disabled={pageCourante <= 1}
                onClick={() => changerPage(pageCourante - 1)}
                className="rounded-lg border border-border bg-card px-3 py-2 disabled:opacity-50"
              >
                Page précédente
              </button>
              <p>
                Page {pageCourante} sur {pages}
              </p>
              <button
                type="button"
                disabled={pageCourante >= pages}
                onClick={() => changerPage(pageCourante + 1)}
                className="rounded-lg border border-border bg-card px-3 py-2 disabled:opacity-50"
              >
                Page suivante
              </button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

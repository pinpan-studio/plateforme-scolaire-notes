"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function useUnsavedChanges(sale: boolean, onNavigate?: (href: string) => void) {
  const router = useRouter();
  const [hrefEnAttente, setHrefEnAttente] = useState<string | null>(null);
  const ignorer = useRef(false);

  useEffect(() => {
    if (!sale) {
      return;
    }

    function avantFermeture(event: BeforeUnloadEvent) {
      if (ignorer.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }

    function surClic(event: MouseEvent) {
      if (ignorer.current) {
        return;
      }
      const cible = event.target;
      if (!(cible instanceof Element)) {
        return;
      }
      const lien = cible.closest("a");
      if (!(lien instanceof HTMLAnchorElement)) {
        return;
      }
      if (lien.target === "_blank" || lien.hasAttribute("download")) {
        return;
      }
      const href = lien.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setHrefEnAttente(lien.href);
    }

    window.addEventListener("beforeunload", avantFermeture);
    document.addEventListener("click", surClic, true);
    return () => {
      window.removeEventListener("beforeunload", avantFermeture);
      document.removeEventListener("click", surClic, true);
    };
  }, [sale]);

  function rester() {
    setHrefEnAttente(null);
  }

  function quitter() {
    if (!hrefEnAttente) {
      return;
    }
    ignorer.current = true;
    const destination = hrefEnAttente;
    setHrefEnAttente(null);
    if (onNavigate) {
      onNavigate(destination);
      return;
    }
    router.push(destination);
  }

  return { hrefEnAttente, rester, quitter };
}

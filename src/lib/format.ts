/** Affichage français des nombres. Ce n'est pas un calcul de moyenne. */

export function formatNombre(value: number, decimales = 2): string {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

export function formatCoefficient(value: number): string {
  const entier = Number.isInteger(value);
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: entier ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

export function formatMoyenne(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return formatNombre(value, 2);
}

export function formatNoteSaisie(value: number): string {
  return formatNombre(value, 2);
}

/** Date ISO `YYYY-MM-DD` affichée `JJ/MM/AAAA`, sans décalage de fuseau. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const [annee, mois, jour] = iso.slice(0, 10).split("-");
  if (!annee || !mois || !jour) {
    return iso;
  }
  return `${jour}/${mois}/${annee}`;
}

export function formatRang(rang: number | null | undefined, effectif: number): string {
  if (rang === null || rang === undefined) {
    return "Non classé";
  }
  const suffixe = rang === 1 ? "er" : "e";
  return `${rang}${suffixe} / ${effectif}`;
}

export function libelleCompteur(
  total: number,
  singulier: string,
  pluriel: string,
  recherche: string,
): string {
  const terme = recherche.trim();
  if (terme) {
    return `${total} résultat${total > 1 ? "s" : ""} pour « ${terme} »`;
  }
  if (total === 1) {
    return `1 ${singulier}`;
  }
  return `${total} ${pluriel}`;
}

export function videOuNull(valeur: string): string | null {
  const texte = valeur.trim();
  return texte ? texte : null;
}

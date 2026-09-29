"use client";

import { useState } from "react";
import { api, indexErreurs, messageUtilisateur } from "@/lib/api-client";
import { formatCoefficient } from "@/lib/format";
import { peutEcrire } from "@/lib/ui-permissions";
import { useApiData } from "@/components/data/use-api-data";
import { useListe } from "@/components/data/use-liste";
import { QueryGate } from "@/components/data/query-gate";
import { useSession } from "@/components/layout/session";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { FiltreSelect } from "@/components/ui/filtre-select";
import { SelectField, TextField } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

export function MatieresPage() {
  const { session } = useSession();
  const toast = useToast();
  const ecriture = peutEcrire(session.utilisateur.role, "matiere");
  const [niveauId, setNiveauId] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [coefficient, setCoefficient] = useState("1");
  const [niveauForm, setNiveauForm] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const liste = useListe(null, { niveauId: niveauId || undefined });
  const matieres = useApiData(liste.cle, () => api.matieres(liste.params));
  const niveaux = useApiData("niveaux-matieres", () => api.niveaux());
  const options = (niveaux.data ?? []).map((niveau) => ({ value: niveau.id, label: niveau.nom }));
  const choisi = options.find((option) => option.value === niveauId);

  async function enregistrer() {
    const suivants: Record<string, string> = {};
    if (!code.trim()) suivants.code = "Indiquez un code.";
    if (!nom.trim()) suivants.nom = "Indiquez un nom.";
    const nombre = Number(coefficient.replace(",", "."));
    if (!(nombre > 0)) suivants.coefficient = "Indiquez un nombre supérieur à 0.";
    setErreurs(suivants);
    if (Object.keys(suivants).length > 0) return;
    setBusy(true);
    try {
      await api.creerMatiere({ code: code.trim(), nom: nom.trim(), coefficient: nombre, niveauId: niveauForm || null });
      setOuvert(false);
      setCode("");
      setNom("");
      matieres.retry();
      toast("Matière enregistrée.");
    } catch (error) {
      const champs = indexErreurs(error);
      setErreurs(Object.keys(champs).length > 0 ? champs : { formulaire: messageUtilisateur(error, "Impossible d'enregistrer la matière.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader titre="Matières" action={ecriture ? <Button onClick={() => setOuvert(true)}>Ajouter une matière</Button> : undefined} />
      <QueryGate loading={matieres.loading} error={matieres.error} onRetry={matieres.retry} hasData={matieres.data !== null}>
        <DataTable
          mode="externe"
          lignes={matieres.data?.items ?? []}
          total={matieres.data?.total ?? 0}
          page={liste.page}
          onPage={liste.setPage}
          recherche={liste.recherche}
          onRecherche={liste.setRecherche}
          tri={liste.tri}
          onTri={liste.changerTri}
          getId={(ligne) => ligne.id}
          texteRecherche={(ligne) => `${ligne.code} ${ligne.nom}`}
          singulier="matière"
          pluriel="matières"
          titreVide="Aucune matière."
          pastilles={choisi ? [{ id: "niveau", label: "Niveau", valeur: choisi.label, onRetirer: () => setNiveauId("") }] : []}
          onReinitialiserFiltres={niveauId ? () => setNiveauId("") : undefined}
          filtres={<FiltreSelect id="filtre-niveau-matiere" label="Niveau" value={niveauId} onChange={setNiveauId} options={options} tousLabel="Tous les niveaux" />}
          colonnes={[
            { key: "code", entete: "Code", triable: true, cellule: (ligne) => ligne.code },
            { key: "nom", entete: "Nom", triable: true, cellule: (ligne) => ligne.nom },
            { key: "coefficient", entete: "Coefficient", triable: true, cellule: (ligne) => formatCoefficient(ligne.coefficient) },
            { key: "niveau", entete: "Niveau", cellule: (ligne) => ligne.niveau ?? "Tous les niveaux" },
          ]}
        />
      </QueryGate>
      <Drawer ouvert={ouvert} titre="Ajouter une matière" onFermer={() => setOuvert(false)} onSubmit={() => void enregistrer()} busy={busy} erreurs={Object.values(erreurs)}>
        <TextField id="code-matiere" label="Code" obligatoire erreur={erreurs.code} value={code} onChange={(event) => setCode(event.target.value)} />
        <TextField id="nom-matiere" label="Nom" obligatoire erreur={erreurs.nom} value={nom} onChange={(event) => setNom(event.target.value)} />
        <TextField id="coef-matiere" label="Coefficient" obligatoire erreur={erreurs.coefficient} value={coefficient} onChange={(event) => setCoefficient(event.target.value)} />
        <SelectField id="niveau-matiere" label="Niveau" value={niveauForm} onChange={(event) => setNiveauForm(event.target.value)}>
          <option value="">Tous les niveaux</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </SelectField>
      </Drawer>
    </div>
  );
}

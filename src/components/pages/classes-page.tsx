"use client";

import { useState } from "react";
import { api, indexErreurs, messageUtilisateur } from "@/lib/api-client";
import type { ClasseEnvoi } from "@/lib/api-client/types";
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

export function ClassesPage() {
  const { anneeId, session } = useSession();
  const toast = useToast();
  const ecriture = peutEcrire(session.utilisateur.role, "classe");
  const [niveauId, setNiveauId] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [niveauForm, setNiveauForm] = useState("");
  const [professeurId, setProfesseurId] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const liste = useListe(anneeId, { niveauId: niveauId || undefined });
  const classes = useApiData(liste.cle, () => api.classes(liste.params));
  const niveaux = useApiData("niveaux", () => api.niveaux());
  const enseignants = useApiData("enseignants-classes", () => api.enseignants({ page: 1, pageSize: 100, statut: "ACTIF" }));
  const optionsNiveaux = (niveaux.data ?? []).map((niveau) => ({ value: niveau.id, label: niveau.nom }));
  const niveauChoisi = optionsNiveaux.find((option) => option.value === niveauId);

  async function enregistrer() {
    const suivants: Record<string, string> = {};
    if (!nom.trim()) suivants.nom = "Indiquez un nom.";
    if (!niveauForm) suivants.niveauId = "Choisissez un niveau.";
    if (!anneeId) suivants.annee = "Choisissez une année scolaire.";
    setErreurs(suivants);
    if (Object.keys(suivants).length > 0 || !anneeId) return;
    const corps: ClasseEnvoi = {
      nom: nom.trim(),
      niveauId: niveauForm,
      anneeScolaireId: anneeId,
      professeurPrincipalId: professeurId || null,
    };
    setBusy(true);
    try {
      await api.creerClasse(corps);
      setOuvert(false);
      setNom("");
      classes.retry();
      toast("Classe enregistrée.");
    } catch (error) {
      const champs = indexErreurs(error);
      setErreurs(Object.keys(champs).length > 0 ? champs : { formulaire: messageUtilisateur(error, "Impossible d'enregistrer la classe.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader titre="Classes" action={ecriture ? <Button onClick={() => setOuvert(true)}>Ajouter une classe</Button> : undefined} />
      <QueryGate loading={classes.loading} error={classes.error} onRetry={classes.retry} hasData={classes.data !== null}>
        <DataTable
          mode="externe"
          lignes={classes.data?.items ?? []}
          total={classes.data?.total ?? 0}
          page={liste.page}
          onPage={liste.setPage}
          recherche={liste.recherche}
          onRecherche={liste.setRecherche}
          tri={liste.tri}
          onTri={liste.changerTri}
          getId={(ligne) => ligne.id}
          texteRecherche={(ligne) => `${ligne.nom} ${ligne.niveau}`}
          hrefLigne={(ligne) => `/classes/${ligne.id}`}
          singulier="classe"
          pluriel="classes"
          titreVide="Aucune classe pour cette année."
          pastilles={niveauChoisi ? [{ id: "niveau", label: "Niveau", valeur: niveauChoisi.label, onRetirer: () => setNiveauId("") }] : []}
          onReinitialiserFiltres={niveauId ? () => setNiveauId("") : undefined}
          filtres={<FiltreSelect id="filtre-niveau" label="Niveau" value={niveauId} onChange={setNiveauId} options={optionsNiveaux} />}
          colonnes={[
            { key: "nom", entete: "Nom", triable: true, cellule: (ligne) => ligne.nom },
            { key: "niveau", entete: "Niveau", triable: true, cellule: (ligne) => ligne.niveau },
            { key: "effectif", entete: "Effectif", triable: true, cellule: (ligne) => String(ligne.effectif) },
            { key: "professeur", entete: "Professeur principal", cellule: (ligne) => ligne.professeurPrincipal ?? "—" },
            { key: "annee", entete: "Année", cellule: (ligne) => ligne.annee },
          ]}
        />
      </QueryGate>
      <Drawer ouvert={ouvert} titre="Ajouter une classe" onFermer={() => setOuvert(false)} onSubmit={() => void enregistrer()} busy={busy} erreurs={Object.values(erreurs)}>
        <TextField id="nom-classe" label="Nom" obligatoire erreur={erreurs.nom} value={nom} onChange={(event) => setNom(event.target.value)} />
        <SelectField id="niveau-classe" label="Niveau" obligatoire erreur={erreurs.niveauId} value={niveauForm} onChange={(event) => setNiveauForm(event.target.value)}>
          <option value="">Choisir</option>
          {optionsNiveaux.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </SelectField>
        <SelectField id="pp-classe" label="Professeur principal" value={professeurId} onChange={(event) => setProfesseurId(event.target.value)}>
          <option value="">Aucun</option>
          {(enseignants.data?.items ?? []).map((enseignant) => (
            <option key={enseignant.id} value={enseignant.id}>{enseignant.nom} {enseignant.prenom}</option>
          ))}
        </SelectField>
      </Drawer>
    </div>
  );
}

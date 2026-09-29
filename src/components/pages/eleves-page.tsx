"use client";

import { useState } from "react";
import { api, indexErreurs, messageUtilisateur } from "@/lib/api-client";
import type { EleveEnvoi, StatutInscription } from "@/lib/api-client/types";
import { libelleInscription } from "@/lib/labels";
import { peutEcrire } from "@/lib/ui-permissions";
import { useApiData } from "@/components/data/use-api-data";
import { useListe } from "@/components/data/use-liste";
import { QueryGate } from "@/components/data/query-gate";
import { useSession } from "@/components/layout/session";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { FiltreSelect } from "@/components/ui/filtre-select";
import { SelectField, TextField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

const VIDE: EleveEnvoi = {
  matricule: "",
  nom: "",
  prenom: "",
  dateNaissance: "",
  sexe: "F",
  classeId: "",
  statut: "INSCRIT",
};

export function ElevesPage() {
  const { anneeId, session } = useSession();
  const toast = useToast();
  const ecriture = peutEcrire(session.utilisateur.role, "eleve");
  const [classeId, setClasseId] = useState("");
  const [statut, setStatut] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState<EleveEnvoi>(VIDE);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const liste = useListe(anneeId, { classeId: classeId || undefined, statut: statut || undefined });
  const eleves = useApiData(liste.cle, () => api.eleves(liste.params));
  const classes = useApiData(`classes-eleves-${anneeId ?? ""}`, () => api.classes({ anneeId, page: 1, pageSize: 100 }));
  const optionsClasses = (classes.data?.items ?? []).map((classe) => ({ value: classe.id, label: classe.nom }));
  const classeChoisie = optionsClasses.find((option) => option.value === classeId);

  async function enregistrer() {
    const suivants: Record<string, string> = {};
    if (!formulaire.matricule.trim()) suivants.matricule = "Indiquez un matricule.";
    if (!formulaire.nom.trim()) suivants.nom = "Indiquez un nom.";
    if (!formulaire.prenom.trim()) suivants.prenom = "Indiquez un prénom.";
    if (!formulaire.dateNaissance) suivants.dateNaissance = "Indiquez une date de naissance.";
    if (!formulaire.classeId) suivants.classeId = "Choisissez une classe.";
    setErreurs(suivants);
    if (Object.keys(suivants).length > 0) return;
    setBusy(true);
    try {
      await api.creerEleve({ ...formulaire, matricule: formulaire.matricule.trim().toUpperCase() });
      setOuvert(false);
      setFormulaire(VIDE);
      eleves.retry();
      toast("Élève enregistré.");
    } catch (error) {
      setErreurs(indexErreurs(error));
      if (Object.keys(indexErreurs(error)).length === 0) {
        setErreurs({ formulaire: messageUtilisateur(error, "Impossible d'enregistrer l'élève.") });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        titre="Élèves"
        action={ecriture ? <Button onClick={() => setOuvert(true)}>Ajouter un élève</Button> : undefined}
      />
      <QueryGate loading={eleves.loading} error={eleves.error} onRetry={eleves.retry} hasData={eleves.data !== null}>
        <DataTable
          mode="externe"
          lignes={eleves.data?.items ?? []}
          total={eleves.data?.total ?? 0}
          page={liste.page}
          onPage={liste.setPage}
          recherche={liste.recherche}
          onRecherche={liste.setRecherche}
          tri={liste.tri}
          onTri={liste.changerTri}
          getId={(ligne) => ligne.id}
          texteRecherche={(ligne) => `${ligne.nom} ${ligne.prenom} ${ligne.matricule}`}
          hrefLigne={(ligne) => `/eleves/${ligne.id}`}
          singulier="élève"
          pluriel="élèves"
          titreVide="Aucun élève pour cette année. Ajoutez le premier élève."
          pastilles={[
            ...(classeChoisie ? [{ id: "classe", label: "Classe", valeur: classeChoisie.label, onRetirer: () => setClasseId("") }] : []),
            ...(statut ? [{ id: "statut", label: "Statut", valeur: libelleInscription(statut as StatutInscription), onRetirer: () => setStatut("") }] : []),
          ]}
          onReinitialiserFiltres={classeId || statut ? () => { setClasseId(""); setStatut(""); } : undefined}
          filtres={
            <>
              <FiltreSelect id="filtre-classe" label="Classe" value={classeId} onChange={setClasseId} options={optionsClasses} />
              <FiltreSelect
                id="filtre-statut"
                label="Statut"
                value={statut}
                onChange={setStatut}
                options={[
                  { value: "INSCRIT", label: "Inscrit" },
                  { value: "SORTI", label: "Sorti" },
                  { value: "TRANSFERE", label: "Transféré" },
                ]}
              />
            </>
          }
          colonnes={[
            { key: "matricule", entete: "Matricule", triable: true, cellule: (ligne) => ligne.matricule },
            { key: "nom", entete: "Nom", triable: true, cellule: (ligne) => ligne.nom },
            { key: "prenom", entete: "Prénom", triable: true, cellule: (ligne) => ligne.prenom },
            { key: "classe", entete: "Classe", triable: true, cellule: (ligne) => ligne.classe ?? "—" },
            { key: "statut", entete: "Statut", cellule: (ligne) => libelleInscription(ligne.statut) },
          ]}
        />
      </QueryGate>
      <Drawer
        ouvert={ouvert}
        titre="Ajouter un élève"
        onFermer={() => setOuvert(false)}
        onSubmit={() => void enregistrer()}
        busy={busy}
        erreurs={Object.values(erreurs)}
      >
        <TextField id="matricule" label="Matricule" obligatoire erreur={erreurs.matricule} value={formulaire.matricule} onChange={(event) => setFormulaire({ ...formulaire, matricule: event.target.value })} />
        <TextField id="nom" label="Nom" obligatoire erreur={erreurs.nom} value={formulaire.nom} onChange={(event) => setFormulaire({ ...formulaire, nom: event.target.value })} />
        <TextField id="prenom" label="Prénom" obligatoire erreur={erreurs.prenom} value={formulaire.prenom} onChange={(event) => setFormulaire({ ...formulaire, prenom: event.target.value })} />
        <TextField id="dateNaissance" label="Date de naissance" type="date" obligatoire erreur={erreurs.dateNaissance} value={formulaire.dateNaissance} onChange={(event) => setFormulaire({ ...formulaire, dateNaissance: event.target.value })} />
        <SelectField id="sexe" label="Sexe" obligatoire value={formulaire.sexe} onChange={(event) => setFormulaire({ ...formulaire, sexe: event.target.value as EleveEnvoi["sexe"] })}>
          <option value="F">Féminin</option>
          <option value="M">Masculin</option>
        </SelectField>
        <SelectField id="classeId" label="Classe" obligatoire erreur={erreurs.classeId} value={formulaire.classeId} onChange={(event) => setFormulaire({ ...formulaire, classeId: event.target.value })}>
          <option value="">Choisir</option>
          {optionsClasses.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </SelectField>
        <SelectField id="statut" label="Statut" value={formulaire.statut} onChange={(event) => setFormulaire({ ...formulaire, statut: event.target.value as StatutInscription })}>
          <option value="INSCRIT">Inscrit</option>
          <option value="SORTI">Sorti</option>
          <option value="TRANSFERE">Transféré</option>
        </SelectField>
      </Drawer>
    </div>
  );
}

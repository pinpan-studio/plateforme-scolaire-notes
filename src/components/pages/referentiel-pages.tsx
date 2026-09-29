"use client";

import { useState } from "react";
import { api, indexErreurs, messageUtilisateur } from "@/lib/api-client";
import type { Role } from "@/lib/api-client/types";
import { formatDate } from "@/lib/format";
import { libelleAnnee } from "@/lib/labels";
import { libelleRole } from "@/lib/nav";
import { peutEcrire } from "@/lib/ui-permissions";
import { useApiData } from "@/components/data/use-api-data";
import { useListe } from "@/components/data/use-liste";
import { QueryGate } from "@/components/data/query-gate";
import { GardeRole } from "@/components/layout/app-shell";
import { useSession } from "@/components/layout/session";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Drawer } from "@/components/ui/drawer";
import { SelectField, TextField } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";

export function AnneesPage() {
  const { session } = useSession();
  const toast = useToast();
  const ecriture = peutEcrire(session.utilisateur.role, "annee");
  const annees = useApiData("annees", () => api.annees());
  const [ouvert, setOuvert] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [cible, setCible] = useState<{ id: string; action: "activer" | "cloturer" } | null>(null);

  async function enregistrer() {
    const suivants: Record<string, string> = {};
    if (!libelle.trim()) suivants.libelle = "Indiquez un libellé.";
    if (!dateDebut || !dateFin || dateFin <= dateDebut) suivants.dateFin = "La date de fin doit être postérieure à la date de début.";
    setErreurs(suivants);
    if (Object.keys(suivants).length > 0) return;
    try {
      await api.creerAnnee({ libelle: libelle.trim(), dateDebut, dateFin });
      setOuvert(false);
      annees.retry();
      toast("Année enregistrée.");
    } catch (error) {
      setErreurs(indexErreurs(error));
    }
  }

  async function confirmer() {
    if (!cible) return;
    try {
      if (cible.action === "activer") await api.activerAnnee(cible.id);
      else await api.cloturerAnnee(cible.id);
      setCible(null);
      annees.retry();
      toast(cible.action === "activer" ? "Année activée." : "Année clôturée.");
    } catch (error) {
      setErreurs({ formulaire: messageUtilisateur(error) });
      setCible(null);
    }
  }

  return (
    <GardeRole roles={["ADMIN", "DIRECTION"]}>
      <PageHeader titre="Années scolaires" action={ecriture ? <Button onClick={() => setOuvert(true)}>Ajouter une année</Button> : undefined} />
      <QueryGate loading={annees.loading} error={annees.error} onRetry={annees.retry} hasData={annees.data !== null}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th scope="col" className="border-b border-border py-2 text-left">Libellé</th>
              <th scope="col" className="border-b border-border py-2 text-left">Début</th>
              <th scope="col" className="border-b border-border py-2 text-left">Fin</th>
              <th scope="col" className="border-b border-border py-2 text-left">Statut</th>
              {ecriture ? <th scope="col" className="border-b border-border py-2 text-left">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {(annees.data ?? []).map((annee) => (
              <tr key={annee.id}>
                <th scope="row" className="py-2 text-left font-normal">{annee.libelle}</th>
                <td>{formatDate(annee.dateDebut)}</td>
                <td>{formatDate(annee.dateFin)}</td>
                <td><Badge ton={annee.statut === "EN_COURS" ? "success" : annee.statut === "CLOTUREE" ? "neutral" : "warning"}>{libelleAnnee(annee.statut)}</Badge></td>
                {ecriture ? (
                  <td className="space-x-2">
                    {annee.statut !== "EN_COURS" ? <button type="button" className="text-primary" onClick={() => setCible({ id: annee.id, action: "activer" })}>Activer</button> : null}
                    {annee.statut !== "CLOTUREE" ? <button type="button" className="text-danger" onClick={() => setCible({ id: annee.id, action: "cloturer" })}>Clôturer</button> : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {annees.data && annees.data.length === 0 ? <p className="mt-4 text-sm text-muted">Aucune année scolaire.</p> : null}
      </QueryGate>
      <Drawer ouvert={ouvert} titre="Ajouter une année" onFermer={() => setOuvert(false)} onSubmit={() => void enregistrer()} erreurs={Object.values(erreurs)}>
        <TextField id="libelle-annee" label="Libellé" obligatoire erreur={erreurs.libelle} value={libelle} onChange={(event) => setLibelle(event.target.value)} />
        <TextField id="debut-annee" label="Date de début" type="date" obligatoire value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} />
        <TextField id="fin-annee" label="Date de fin" type="date" obligatoire erreur={erreurs.dateFin} value={dateFin} onChange={(event) => setDateFin(event.target.value)} />
      </Drawer>
      <Dialog
        ouvert={cible !== null}
        titre={cible?.action === "cloturer" ? "Clôturer l'année ?" : "Activer cette année ?"}
        description={cible?.action === "cloturer" ? "Les saisies de cette année deviennent en lecture seule, sauf correction autorisée." : "Une seule année peut être active."}
        confirmerLabel={cible?.action === "cloturer" ? "Clôturer" : "Activer"}
        danger={cible?.action === "cloturer"}
        onAnnuler={() => setCible(null)}
        onConfirmer={() => void confirmer()}
      />
    </GardeRole>
  );
}

export function EnseignantsPage() {
  const { session } = useSession();
  const toast = useToast();
  const ecriture = peutEcrire(session.utilisateur.role, "enseignant");
  const liste = useListe(null);
  const enseignants = useApiData(liste.cle, () => api.enseignants(liste.params));
  const [ouvert, setOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState({ nom: "", prenom: "", email: "", telephone: "", statut: "ACTIF" as "ACTIF" | "INACTIF" });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  async function enregistrer() {
    const suivants: Record<string, string> = {};
    if (!formulaire.nom.trim()) suivants.nom = "Indiquez un nom.";
    if (!formulaire.prenom.trim()) suivants.prenom = "Indiquez un prénom.";
    if (!formulaire.email.includes("@")) suivants.email = "Indiquez un e-mail.";
    setErreurs(suivants);
    if (Object.keys(suivants).length > 0) return;
    try {
      await api.creerEnseignant({ ...formulaire, telephone: formulaire.telephone.trim() || null });
      setOuvert(false);
      enseignants.retry();
      toast("Enseignant enregistré.");
    } catch (error) {
      const champs = indexErreurs(error);
      setErreurs(Object.keys(champs).length > 0 ? champs : { formulaire: messageUtilisateur(error) });
    }
  }

  return (
    <GardeRole roles={["ADMIN", "DIRECTION"]}>
      <PageHeader titre="Enseignants" action={ecriture ? <Button onClick={() => setOuvert(true)}>Ajouter un enseignant</Button> : undefined} />
      <QueryGate loading={enseignants.loading} error={enseignants.error} onRetry={enseignants.retry} hasData={enseignants.data !== null}>
        <DataTable
          mode="externe"
          lignes={enseignants.data?.items ?? []}
          total={enseignants.data?.total ?? 0}
          page={liste.page}
          onPage={liste.setPage}
          recherche={liste.recherche}
          onRecherche={liste.setRecherche}
          tri={liste.tri}
          onTri={liste.changerTri}
          getId={(ligne) => ligne.id}
          texteRecherche={(ligne) => `${ligne.nom} ${ligne.prenom} ${ligne.email}`}
          singulier="enseignant"
          pluriel="enseignants"
          titreVide="Aucun enseignant."
          colonnes={[
            { key: "nom", entete: "Nom", triable: true, cellule: (ligne) => ligne.nom },
            { key: "prenom", entete: "Prénom", triable: true, cellule: (ligne) => ligne.prenom },
            { key: "email", entete: "E-mail", cellule: (ligne) => ligne.email },
            { key: "telephone", entete: "Téléphone", cellule: (ligne) => ligne.telephone ?? "—" },
            { key: "statut", entete: "Statut", cellule: (ligne) => (ligne.statut === "ACTIF" ? "Actif" : "Inactif") },
          ]}
        />
      </QueryGate>
      <Drawer ouvert={ouvert} titre="Ajouter un enseignant" onFermer={() => setOuvert(false)} onSubmit={() => void enregistrer()} erreurs={Object.values(erreurs)}>
        <TextField id="nom-ens" label="Nom" obligatoire erreur={erreurs.nom} value={formulaire.nom} onChange={(event) => setFormulaire({ ...formulaire, nom: event.target.value })} />
        <TextField id="prenom-ens" label="Prénom" obligatoire erreur={erreurs.prenom} value={formulaire.prenom} onChange={(event) => setFormulaire({ ...formulaire, prenom: event.target.value })} />
        <TextField id="email-ens" label="E-mail" type="email" obligatoire erreur={erreurs.email} value={formulaire.email} onChange={(event) => setFormulaire({ ...formulaire, email: event.target.value })} />
        <TextField id="tel-ens" label="Téléphone" value={formulaire.telephone} onChange={(event) => setFormulaire({ ...formulaire, telephone: event.target.value })} />
        <SelectField id="statut-ens" label="Statut" value={formulaire.statut} onChange={(event) => setFormulaire({ ...formulaire, statut: event.target.value as "ACTIF" | "INACTIF" })}>
          <option value="ACTIF">Actif</option>
          <option value="INACTIF">Inactif</option>
        </SelectField>
      </Drawer>
    </GardeRole>
  );
}

export function AffectationsPage() {
  const { anneeId, session } = useSession();
  const toast = useToast();
  const ecriture = peutEcrire(session.utilisateur.role, "affectation");
  const liste = useListe(anneeId);
  const affectations = useApiData(liste.cle, () => api.affectations(liste.params));
  const enseignants = useApiData("ens-aff", () => api.enseignants({ page: 1, pageSize: 100 }));
  const classes = useApiData(`cls-aff-${anneeId ?? ""}`, () => api.classes({ anneeId, page: 1, pageSize: 100 }));
  const matieres = useApiData("mat-aff", () => api.matieres({ page: 1, pageSize: 100 }));
  const [ouvert, setOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState({ enseignantId: "", classeId: "", matiereId: "" });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  async function enregistrer() {
    if (!anneeId || !formulaire.enseignantId || !formulaire.classeId || !formulaire.matiereId) {
      setErreurs({ formulaire: "Choisissez un enseignant, une classe et une matière." });
      return;
    }
    try {
      await api.creerAffectation({ ...formulaire, anneeScolaireId: anneeId });
      setOuvert(false);
      affectations.retry();
      toast("Affectation enregistrée.");
    } catch (error) {
      setErreurs({ formulaire: messageUtilisateur(error, "Cette affectation existe déjà.") });
    }
  }

  return (
    <GardeRole roles={["ADMIN", "DIRECTION"]}>
      <PageHeader titre="Affectations" action={ecriture ? <Button onClick={() => setOuvert(true)}>Ajouter une affectation</Button> : undefined} />
      <QueryGate loading={affectations.loading} error={affectations.error} onRetry={affectations.retry} hasData={affectations.data !== null}>
        <DataTable
          mode="externe"
          lignes={affectations.data?.items ?? []}
          total={affectations.data?.total ?? 0}
          page={liste.page}
          onPage={liste.setPage}
          recherche={liste.recherche}
          onRecherche={liste.setRecherche}
          tri={liste.tri}
          onTri={liste.changerTri}
          getId={(ligne) => ligne.id}
          texteRecherche={(ligne) => `${ligne.enseignant} ${ligne.classe} ${ligne.matiere}`}
          singulier="affectation"
          pluriel="affectations"
          titreVide="Aucune affectation pour cette année."
          colonnes={[
            { key: "enseignant", entete: "Enseignant", triable: true, cellule: (ligne) => ligne.enseignant },
            { key: "classe", entete: "Classe", triable: true, cellule: (ligne) => ligne.classe },
            { key: "matiere", entete: "Matière", triable: true, cellule: (ligne) => ligne.matiere },
            { key: "annee", entete: "Année", cellule: (ligne) => ligne.annee },
            {
              key: "action",
              entete: "Action",
              cellule: (ligne) => ecriture ? (
                <button type="button" className="text-danger" onClick={() => void api.supprimerAffectation(ligne.id).then(() => affectations.retry())}>Supprimer</button>
              ) : "—",
            },
          ]}
        />
      </QueryGate>
      <Drawer ouvert={ouvert} titre="Ajouter une affectation" onFermer={() => setOuvert(false)} onSubmit={() => void enregistrer()} erreurs={Object.values(erreurs)}>
        <SelectField id="ens-aff" label="Enseignant" obligatoire value={formulaire.enseignantId} onChange={(event) => setFormulaire({ ...formulaire, enseignantId: event.target.value })}>
          <option value="">Choisir</option>
          {(enseignants.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nom} {item.prenom}</option>)}
        </SelectField>
        <SelectField id="cls-aff" label="Classe" obligatoire value={formulaire.classeId} onChange={(event) => setFormulaire({ ...formulaire, classeId: event.target.value })}>
          <option value="">Choisir</option>
          {(classes.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
        </SelectField>
        <SelectField id="mat-aff" label="Matière" obligatoire value={formulaire.matiereId} onChange={(event) => setFormulaire({ ...formulaire, matiereId: event.target.value })}>
          <option value="">Choisir</option>
          {(matieres.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
        </SelectField>
      </Drawer>
    </GardeRole>
  );
}

export function PeriodesPage() {
  const { anneeId, session } = useSession();
  const toast = useToast();
  const ecriture = peutEcrire(session.utilisateur.role, "periode");
  const periodes = useApiData(`periodes-page-${anneeId ?? ""}`, () => api.periodes(anneeId));
  const [ouvert, setOuvert] = useState(false);
  const [formulaire, setFormulaire] = useState({ libelle: "", ordre: "1", dateDebut: "", dateFin: "" });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  async function enregistrer() {
    const suivants: Record<string, string> = {};
    if (!formulaire.libelle.trim()) suivants.libelle = "Indiquez un libellé.";
    if (!anneeId) suivants.annee = "Choisissez une année.";
    if (formulaire.dateFin <= formulaire.dateDebut) suivants.dateFin = "La date de fin doit être postérieure à la date de début.";
    setErreurs(suivants);
    if (Object.keys(suivants).length > 0 || !anneeId) return;
    try {
      await api.creerPeriode({
        anneeScolaireId: anneeId,
        libelle: formulaire.libelle.trim(),
        ordre: Number(formulaire.ordre),
        dateDebut: formulaire.dateDebut,
        dateFin: formulaire.dateFin,
      });
      setOuvert(false);
      periodes.retry();
      toast("Période enregistrée.");
    } catch (error) {
      setErreurs({ formulaire: messageUtilisateur(error) });
    }
  }

  return (
    <div>
      <PageHeader titre="Périodes" action={ecriture ? <Button onClick={() => setOuvert(true)}>Ajouter une période</Button> : undefined} />
      <QueryGate loading={periodes.loading} error={periodes.error} onRetry={periodes.retry} hasData={periodes.data !== null}>
        {(periodes.data ?? []).length === 0 ? <p className="text-sm text-muted">Aucune période pour cette année.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th scope="col" className="border-b border-border py-2 text-left">Libellé</th>
                <th scope="col" className="border-b border-border py-2 text-left">Ordre</th>
                <th scope="col" className="border-b border-border py-2 text-left">Début</th>
                <th scope="col" className="border-b border-border py-2 text-left">Fin</th>
              </tr>
            </thead>
            <tbody>
              {(periodes.data ?? []).map((periode) => (
                <tr key={periode.id}>
                  <th scope="row" className="py-2 text-left font-normal">{periode.libelle}</th>
                  <td>{periode.ordre}</td>
                  <td>{formatDate(periode.dateDebut)}</td>
                  <td>{formatDate(periode.dateFin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </QueryGate>
      <Drawer ouvert={ouvert} titre="Ajouter une période" onFermer={() => setOuvert(false)} onSubmit={() => void enregistrer()} erreurs={Object.values(erreurs)}>
        <TextField id="libelle-periode" label="Libellé" obligatoire erreur={erreurs.libelle} value={formulaire.libelle} onChange={(event) => setFormulaire({ ...formulaire, libelle: event.target.value })} />
        <SelectField id="ordre-periode" label="Ordre" value={formulaire.ordre} onChange={(event) => setFormulaire({ ...formulaire, ordre: event.target.value })}>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </SelectField>
        <TextField id="debut-periode" label="Date de début" type="date" obligatoire value={formulaire.dateDebut} onChange={(event) => setFormulaire({ ...formulaire, dateDebut: event.target.value })} />
        <TextField id="fin-periode" label="Date de fin" type="date" obligatoire erreur={erreurs.dateFin} value={formulaire.dateFin} onChange={(event) => setFormulaire({ ...formulaire, dateFin: event.target.value })} />
      </Drawer>
    </div>
  );
}

export function EtablissementPage() {
  const etablissement = useApiData("etablissement", () => api.etablissement());
  const [formulaire, setFormulaire] = useState({ nom: "", adresse: "", telephone: "", email: "" });
  const [pret, setPret] = useState(false);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const toast = useToast();
  if (etablissement.data && !pret) {
    setFormulaire({
      nom: etablissement.data.nom,
      adresse: etablissement.data.adresse,
      telephone: etablissement.data.telephone,
      email: etablissement.data.email,
    });
    setPret(true);
  }

  async function enregistrer() {
    try {
      await api.enregistrerEtablissement(formulaire);
      toast("Établissement enregistré.");
    } catch (error) {
      setErreurs(indexErreurs(error));
    }
  }

  return (
    <GardeRole roles={["ADMIN"]}>
      <PageHeader titre="Établissement" />
      <QueryGate loading={etablissement.loading} error={etablissement.error} onRetry={etablissement.retry} hasData={etablissement.data !== null}>
        <form className="max-w-lg space-y-4" onSubmit={(event) => { event.preventDefault(); void enregistrer(); }}>
          <p className="text-sm text-muted">Champs obligatoires</p>
          <TextField id="nom-etab" label="Nom" obligatoire value={formulaire.nom} onChange={(event) => setFormulaire({ ...formulaire, nom: event.target.value })} />
          <TextField id="adresse-etab" label="Adresse" obligatoire value={formulaire.adresse} onChange={(event) => setFormulaire({ ...formulaire, adresse: event.target.value })} />
          <TextField id="tel-etab" label="Téléphone" obligatoire erreur={erreurs.telephone} value={formulaire.telephone} onChange={(event) => setFormulaire({ ...formulaire, telephone: event.target.value })} />
          <TextField id="email-etab" label="E-mail" type="email" obligatoire erreur={erreurs.email} value={formulaire.email} onChange={(event) => setFormulaire({ ...formulaire, email: event.target.value })} />
          <Button type="submit">Enregistrer</Button>
        </form>
      </QueryGate>
    </GardeRole>
  );
}

export function UtilisateursPage() {
  const toast = useToast();
  const utilisateurs = useApiData("utilisateurs", () => api.utilisateurs());
  const enseignants = useApiData("ens-users", () => api.enseignants({ page: 1, pageSize: 100 }));
  const [ouvert, setOuvert] = useState(false);
  const [motDePasse, setMotDePasse] = useState<string | null>(null);
  const [formulaire, setFormulaire] = useState({ email: "", prenom: "", nom: "", role: "CONSULTATION" as Role, enseignantId: "", motDePasse: "" });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  async function enregistrer() {
    const lie = formulaire.role === "ENSEIGNANT" || formulaire.role === "PROFESSEUR_PRINCIPAL";
    if (lie && !formulaire.enseignantId) {
      setErreurs({ enseignantId: "Choisissez l'enseignant lié à ce compte." });
      return;
    }
    try {
      const cree = await api.creerUtilisateur({
        ...formulaire,
        enseignantId: formulaire.enseignantId || null,
      });
      setMotDePasse(cree.motDePasseTemporaire);
      setOuvert(false);
      utilisateurs.retry();
    } catch (error) {
      setErreurs({ formulaire: messageUtilisateur(error) });
    }
  }

  return (
    <GardeRole roles={["ADMIN"]}>
      <PageHeader titre="Utilisateurs" action={<Button onClick={() => setOuvert(true)}>Ajouter un utilisateur</Button>} />
      {motDePasse ? <div className="mb-4"><Banner ton="warning">Mot de passe temporaire : {motDePasse}. Il ne sera plus affiché.</Banner></div> : null}
      <QueryGate loading={utilisateurs.loading} error={utilisateurs.error} onRetry={utilisateurs.retry} hasData={utilisateurs.data !== null}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th scope="col" className="border-b border-border py-2 text-left">Nom</th>
              <th scope="col" className="border-b border-border py-2 text-left">E-mail</th>
              <th scope="col" className="border-b border-border py-2 text-left">Rôle</th>
              <th scope="col" className="border-b border-border py-2 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {(utilisateurs.data ?? []).map((utilisateur) => (
              <tr key={utilisateur.id}>
                <th scope="row" className="py-2 text-left font-normal">{utilisateur.nom} {utilisateur.prenom}</th>
                <td>{utilisateur.email}</td>
                <td>{libelleRole(utilisateur.role)}</td>
                <td>
                  <button
                    type="button"
                    className="text-primary"
                    onClick={() => void api.modifierUtilisateur(utilisateur.id, { actif: !utilisateur.actif, role: utilisateur.role, enseignantId: utilisateur.enseignantId }).then(() => { utilisateurs.retry(); toast(utilisateur.actif ? "Compte désactivé." : "Compte activé."); })}
                  >
                    {utilisateur.actif ? "Désactiver" : "Activer"}
                  </button>
                  <button
                    type="button"
                    className="ml-3 text-primary"
                    onClick={() => void api.motDePasseTemporaire(utilisateur.id).then((reponse) => setMotDePasse(reponse.motDePasseTemporaire))}
                  >
                    Définir un nouveau mot de passe temporaire
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </QueryGate>
      <Drawer ouvert={ouvert} titre="Ajouter un utilisateur" onFermer={() => setOuvert(false)} onSubmit={() => void enregistrer()} erreurs={Object.values(erreurs)}>
        <TextField id="email-user" label="E-mail" type="email" obligatoire value={formulaire.email} onChange={(event) => setFormulaire({ ...formulaire, email: event.target.value })} />
        <TextField id="prenom-user" label="Prénom" obligatoire value={formulaire.prenom} onChange={(event) => setFormulaire({ ...formulaire, prenom: event.target.value })} />
        <TextField id="nom-user" label="Nom" obligatoire value={formulaire.nom} onChange={(event) => setFormulaire({ ...formulaire, nom: event.target.value })} />
        <SelectField id="role-user" label="Rôle" value={formulaire.role} onChange={(event) => setFormulaire({ ...formulaire, role: event.target.value as Role })}>
          <option value="ADMIN">Administration</option>
          <option value="DIRECTION">Direction</option>
          <option value="ENSEIGNANT">Enseignant</option>
          <option value="PROFESSEUR_PRINCIPAL">Professeur principal</option>
          <option value="CONSULTATION">Consultation</option>
        </SelectField>
        <SelectField id="ens-user" label="Enseignant lié" erreur={erreurs.enseignantId} value={formulaire.enseignantId} onChange={(event) => setFormulaire({ ...formulaire, enseignantId: event.target.value })}>
          <option value="">Aucun</option>
          {(enseignants.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nom} {item.prenom}</option>)}
        </SelectField>
        <TextField id="mdp-user" label="Mot de passe initial" type="password" obligatoire value={formulaire.motDePasse} onChange={(event) => setFormulaire({ ...formulaire, motDePasse: event.target.value })} />
      </Drawer>
    </GardeRole>
  );
}

export function ProfilPage() {
  const { session } = useSession();
  const toast = useToast();
  const [actuel, setActuel] = useState("");
  const [suivant, setSuivant] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    if (suivant !== confirmation) {
      setErreur("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    try {
      await api.changerMotDePasse({ motDePasseActuel: actuel, nouveauMotDePasse: suivant });
      setActuel("");
      setSuivant("");
      setConfirmation("");
      setErreur(null);
      toast("Mot de passe modifié.");
    } catch (error) {
      setErreur(messageUtilisateur(error, "Impossible de modifier le mot de passe."));
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader titre="Mon profil" />
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Nom</dt><dd>{session.utilisateur.prenom} {session.utilisateur.nom}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">E-mail</dt><dd>{session.utilisateur.email}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Rôle</dt><dd>{libelleRole(session.utilisateur.role)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Téléphone</dt><dd>{session.utilisateur.telephone ?? "—"}</dd></div>
      </dl>
      <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void enregistrer(); }}>
        <h2 className="text-lg font-semibold">Mot de passe</h2>
        <TextField id="mdp-actuel" label="Mot de passe actuel" type="password" obligatoire value={actuel} onChange={(event) => setActuel(event.target.value)} />
        <TextField id="mdp-nouveau" label="Nouveau mot de passe" type="password" obligatoire value={suivant} onChange={(event) => setSuivant(event.target.value)} />
        <TextField id="mdp-confirmation" label="Confirmation" type="password" obligatoire erreur={erreur ?? undefined} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
        <Button type="submit">Enregistrer</Button>
      </form>
    </div>
  );
}

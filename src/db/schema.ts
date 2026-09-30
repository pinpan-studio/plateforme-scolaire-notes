import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  integer,
} from "drizzle-orm/pg-core";

/**
 * Schéma relationnel du cahier de notes.
 * Les triggers (note ≤ note_max, dates, affectation) vivent dans drizzle/triggers.sql :
 * une contrainte CHECK ne peut pas lire une autre table.
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

export const role = pgTable("role", {
  code: text("code").primaryKey(),
  libelle: text("libelle").notNull(),
  ...timestamps,
});

export const etablissement = pgTable("etablissement", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: text("nom").notNull(),
  adresse: text("adresse").notNull(),
  telephone: text("telephone").notNull(),
  email: text("email").notNull(),
  ...timestamps,
});

export const anneeScolaire = pgTable(
  "annee_scolaire",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissementId: uuid("etablissement_id").notNull(),
    libelle: text("libelle").notNull(),
    dateDebut: date("date_debut").notNull(),
    dateFin: date("date_fin").notNull(),
    statut: text("statut").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.etablissementId],
      foreignColumns: [etablissement.id],
      name: "annee_scolaire_etablissement_id_fk",
    }).onDelete("restrict"),
    unique("annee_scolaire_etablissement_libelle_unique").on(t.etablissementId, t.libelle),
    uniqueIndex("annee_scolaire_une_en_cours")
      .on(t.etablissementId)
      .where(sql`${t.statut} = 'EN_COURS'`),
    check("annee_scolaire_dates", sql`${t.dateFin} > ${t.dateDebut}`),
    check(
      "annee_scolaire_statut",
      sql`${t.statut} IN ('PREPARATION', 'EN_COURS', 'CLOTUREE')`,
    ),
  ],
);

export const niveau = pgTable(
  "niveau",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    nom: text("nom").notNull(),
    ordre: integer("ordre").notNull(),
    ...timestamps,
  },
  (t) => [
    unique("niveau_code_unique").on(t.code),
    unique("niveau_ordre_unique").on(t.ordre),
    check("niveau_ordre_positif", sql`${t.ordre} > 0`),
  ],
);

export const enseignant = pgTable(
  "enseignant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nom: text("nom").notNull(),
    prenom: text("prenom").notNull(),
    email: text("email").notNull(),
    telephone: text("telephone"),
    statut: text("statut").notNull().default("ACTIF"),
    ...timestamps,
  },
  (t) => [
    unique("enseignant_email_unique").on(t.email),
    check("enseignant_statut", sql`${t.statut} IN ('ACTIF', 'INACTIF')`),
    check("enseignant_email_forme", sql`${t.email} ~ '^[^@[:space:]]+@[^@[:space:]]+$'`),
  ],
);

export const classe = pgTable(
  "classe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anneeScolaireId: uuid("annee_scolaire_id").notNull(),
    niveauId: uuid("niveau_id").notNull(),
    nom: text("nom").notNull(),
    professeurPrincipalId: uuid("professeur_principal_id"),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.anneeScolaireId],
      foreignColumns: [anneeScolaire.id],
      name: "classe_annee_scolaire_id_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.niveauId],
      foreignColumns: [niveau.id],
      name: "classe_niveau_id_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.professeurPrincipalId],
      foreignColumns: [enseignant.id],
      name: "classe_professeur_principal_id_fk",
    }).onDelete("set null"),
    unique("classe_annee_nom_unique").on(t.anneeScolaireId, t.nom),
    index("idx_classe_annee").on(t.anneeScolaireId),
  ],
);

export const eleve = pgTable(
  "eleve",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matricule: text("matricule").notNull(),
    nom: text("nom").notNull(),
    prenom: text("prenom").notNull(),
    dateNaissance: date("date_naissance").notNull(),
    sexe: text("sexe").notNull(),
    statut: text("statut").notNull().default("ACTIF"),
    ...timestamps,
  },
  (t) => [
    unique("eleve_matricule_unique").on(t.matricule),
    index("idx_eleve_nom").on(t.nom, t.prenom),
    check("eleve_sexe", sql`${t.sexe} IN ('F', 'M')`),
    check("eleve_statut", sql`${t.statut} IN ('ACTIF', 'SORTI', 'TRANSFERE')`),
  ],
);

export const matiere = pgTable(
  "matiere",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    nom: text("nom").notNull(),
    coefficient: numeric("coefficient", { precision: 4, scale: 2, mode: "number" }).notNull(),
    niveauId: uuid("niveau_id"),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.niveauId],
      foreignColumns: [niveau.id],
      name: "matiere_niveau_id_fk",
    }).onDelete("restrict"),
    unique("matiere_code_unique").on(t.code),
    unique("matiere_nom_unique").on(t.nom),
    check("matiere_coefficient_positif", sql`${t.coefficient} > 0`),
  ],
);

export const affectationEnseignant = pgTable(
  "affectation_enseignant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enseignantId: uuid("enseignant_id").notNull(),
    classeId: uuid("classe_id").notNull(),
    matiereId: uuid("matiere_id").notNull(),
    anneeScolaireId: uuid("annee_scolaire_id").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.enseignantId],
      foreignColumns: [enseignant.id],
      name: "affectation_enseignant_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.classeId],
      foreignColumns: [classe.id],
      name: "affectation_classe_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.matiereId],
      foreignColumns: [matiere.id],
      name: "affectation_matiere_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.anneeScolaireId],
      foreignColumns: [anneeScolaire.id],
      name: "affectation_annee_scolaire_id_fk",
    }).onDelete("cascade"),
    unique("affectation_combinaison_unique").on(
      t.enseignantId,
      t.classeId,
      t.matiereId,
      t.anneeScolaireId,
    ),
    unique("affectation_classe_matiere_annee_unique").on(t.classeId, t.matiereId, t.anneeScolaireId),
    index("idx_affectation_enseignant").on(t.enseignantId),
  ],
);

export const periode = pgTable(
  "periode",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    anneeScolaireId: uuid("annee_scolaire_id").notNull(),
    libelle: text("libelle").notNull(),
    ordre: integer("ordre").notNull(),
    dateDebut: date("date_debut").notNull(),
    dateFin: date("date_fin").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.anneeScolaireId],
      foreignColumns: [anneeScolaire.id],
      name: "periode_annee_scolaire_id_fk",
    }).onDelete("cascade"),
    unique("periode_annee_ordre_unique").on(t.anneeScolaireId, t.ordre),
    unique("periode_annee_libelle_unique").on(t.anneeScolaireId, t.libelle),
    index("idx_periode_annee").on(t.anneeScolaireId),
    check("periode_dates", sql`${t.dateFin} > ${t.dateDebut}`),
    check("periode_ordre_trimestre", sql`${t.ordre} BETWEEN 1 AND 3`),
  ],
);

export const inscription = pgTable(
  "inscription",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eleveId: uuid("eleve_id").notNull(),
    classeId: uuid("classe_id").notNull(),
    anneeScolaireId: uuid("annee_scolaire_id").notNull(),
    statut: text("statut").notNull().default("INSCRIT"),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.eleveId],
      foreignColumns: [eleve.id],
      name: "inscription_eleve_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.classeId],
      foreignColumns: [classe.id],
      name: "inscription_classe_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.anneeScolaireId],
      foreignColumns: [anneeScolaire.id],
      name: "inscription_annee_scolaire_id_fk",
    }).onDelete("cascade"),
    unique("inscription_eleve_annee_unique").on(t.eleveId, t.anneeScolaireId),
    index("idx_inscription_classe").on(t.classeId),
    index("idx_inscription_eleve").on(t.eleveId),
    check("inscription_statut", sql`${t.statut} IN ('INSCRIT', 'TRANSFERE', 'SORTI')`),
  ],
);

export const evaluation = pgTable(
  "evaluation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matiereId: uuid("matiere_id").notNull(),
    classeId: uuid("classe_id").notNull(),
    enseignantId: uuid("enseignant_id").notNull(),
    periodeId: uuid("periode_id").notNull(),
    type: text("type").notNull(),
    libelle: text("libelle").notNull(),
    date: date("date").notNull(),
    noteMax: numeric("note_max", { precision: 5, scale: 2, mode: "number" }).notNull(),
    coefficient: numeric("coefficient", { precision: 4, scale: 2, mode: "number" }).notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.matiereId],
      foreignColumns: [matiere.id],
      name: "evaluation_matiere_id_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.classeId],
      foreignColumns: [classe.id],
      name: "evaluation_classe_id_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.enseignantId],
      foreignColumns: [enseignant.id],
      name: "evaluation_enseignant_id_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.periodeId],
      foreignColumns: [periode.id],
      name: "evaluation_periode_id_fk",
    }).onDelete("restrict"),
    index("idx_evaluation_classe_periode").on(t.classeId, t.periodeId),
    index("idx_evaluation_matiere").on(t.matiereId),
    index("idx_evaluation_enseignant").on(t.enseignantId),
    check("evaluation_note_max_positive", sql`${t.noteMax} > 0 AND ${t.noteMax} <= 100`),
    check("evaluation_coefficient_positif", sql`${t.coefficient} > 0`),
    check(
      "evaluation_type",
      sql`${t.type} IN ('DEVOIR', 'COMPOSITION', 'INTERROGATION')`,
    ),
  ],
);

export const note = pgTable(
  "note",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eleveId: uuid("eleve_id").notNull(),
    evaluationId: uuid("evaluation_id").notNull(),
    valeur: numeric("valeur", { precision: 5, scale: 2, mode: "number" }),
    estAbsent: boolean("est_absent").notNull().default(false),
    commentaire: text("commentaire"),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.eleveId],
      foreignColumns: [eleve.id],
      name: "note_eleve_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.evaluationId],
      foreignColumns: [evaluation.id],
      name: "note_evaluation_id_fk",
    }).onDelete("cascade"),
    unique("note_eleve_evaluation_unique").on(t.eleveId, t.evaluationId),
    index("idx_note_eleve").on(t.eleveId),
    index("idx_note_evaluation").on(t.evaluationId),
    check("note_valeur_non_negative", sql`${t.valeur} IS NULL OR ${t.valeur} >= 0`),
    check(
      "note_absence_coherente",
      sql`(${t.estAbsent} = true AND ${t.valeur} IS NULL) OR (${t.estAbsent} = false AND ${t.valeur} IS NOT NULL)`,
    ),
  ],
);

export const utilisateur = pgTable(
  "utilisateur",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    motDePasseHash: text("mot_de_passe_hash").notNull(),
    roleCode: text("role_code").notNull(),
    enseignantId: uuid("enseignant_id"),
    prenom: text("prenom").notNull(),
    nom: text("nom").notNull(),
    actif: boolean("actif").notNull().default(true),
    sessionVersion: integer("session_version").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.roleCode],
      foreignColumns: [role.code],
      name: "utilisateur_role_code_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.enseignantId],
      foreignColumns: [enseignant.id],
      name: "utilisateur_enseignant_id_fk",
    }).onDelete("set null"),
    unique("utilisateur_email_unique").on(t.email),
    unique("utilisateur_enseignant_unique").on(t.enseignantId),
    index("idx_utilisateur_role").on(t.roleCode),
    check("utilisateur_email_forme", sql`${t.email} ~ '^[^@[:space:]]+@[^@[:space:]]+$'`),
    check(
      "utilisateur_role_enseignant_lie",
      sql`${t.roleCode} NOT IN ('ENSEIGNANT', 'PROFESSEUR_PRINCIPAL') OR ${t.enseignantId} IS NOT NULL`,
    ),
    check("utilisateur_session_version_non_negative", sql`${t.sessionVersion} >= 0`),
  ],
);

export const appreciationGenerale = pgTable(
  "appreciation_generale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eleveId: uuid("eleve_id").notNull(),
    periodeId: uuid("periode_id").notNull(),
    texte: text("texte").notNull(),
    auteurId: uuid("auteur_id").notNull(),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      columns: [t.eleveId],
      foreignColumns: [eleve.id],
      name: "appreciation_generale_eleve_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.periodeId],
      foreignColumns: [periode.id],
      name: "appreciation_generale_periode_id_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.auteurId],
      foreignColumns: [utilisateur.id],
      name: "appreciation_generale_auteur_id_fk",
    }).onDelete("restrict"),
    unique("appreciation_generale_eleve_periode_unique").on(t.eleveId, t.periodeId),
  ],
);

export const journalAudit = pgTable(
  "journal_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    acteurId: uuid("acteur_id"),
    identifiant: text("identifiant"),
    resultat: text("resultat").notNull(),
    adresseIp: text("adresse_ip"),
    action: text("action"),
    cibleType: text("cible_type"),
    cibleId: uuid("cible_id"),
    ancienneValeur: text("ancienne_valeur"),
    nouvelleValeur: text("nouvelle_valeur"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.acteurId],
      foreignColumns: [utilisateur.id],
      name: "journal_audit_acteur_id_fk",
    }).onDelete("set null"),
    index("idx_journal_audit_created").on(t.createdAt),
    check(
      "journal_audit_type",
      sql`${t.type} IN ('AUTH_SUCCES', 'AUTH_ECHEC', 'DECONNEXION', 'NOTE_CREATION', 'NOTE_MODIFICATION', 'NOTE_SUPPRESSION', 'NOTE_VALIDATION', 'AUTORISATION_REFUSEE', 'MOT_DE_PASSE')`,
    ),
  ],
);

/**
 * Compteurs de tentatives partagés entre les instances.
 * `cle` et `sujet` sont des HMAC : ni l'e-mail ni le jeton n'y figurent en clair.
 * Une ligne = un essai. La fenêtre glissante ignore, puis supprime, les lignes périmées.
 */
export const limiteTentative = pgTable(
  "limite_tentative",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portee: text("portee").notNull(),
    cle: text("cle").notNull(),
    sujet: text("sujet"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_limite_tentative_cle").on(t.portee, t.cle, t.createdAt),
    index("idx_limite_tentative_sujet").on(t.portee, t.sujet),
    index("idx_limite_tentative_created").on(t.createdAt),
    check(
      "limite_tentative_portee",
      sql`${t.portee} IN ('connexion_email', 'connexion_ip', 'mot_de_passe_sujet', 'mot_de_passe_ip', 'validation_sujet', 'validation_ip')`,
    ),
  ],
);

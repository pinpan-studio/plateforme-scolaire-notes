CREATE TABLE "affectation_enseignant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enseignant_id" uuid NOT NULL,
	"classe_id" uuid NOT NULL,
	"matiere_id" uuid NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affectation_combinaison_unique" UNIQUE("enseignant_id","classe_id","matiere_id","annee_scolaire_id"),
	CONSTRAINT "affectation_classe_matiere_annee_unique" UNIQUE("classe_id","matiere_id","annee_scolaire_id")
);
--> statement-breakpoint
CREATE TABLE "annee_scolaire" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"etablissement_id" uuid NOT NULL,
	"libelle" text NOT NULL,
	"date_debut" date NOT NULL,
	"date_fin" date NOT NULL,
	"statut" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "annee_scolaire_etablissement_libelle_unique" UNIQUE("etablissement_id","libelle"),
	CONSTRAINT "annee_scolaire_dates" CHECK ("annee_scolaire"."date_fin" > "annee_scolaire"."date_debut"),
	CONSTRAINT "annee_scolaire_statut" CHECK ("annee_scolaire"."statut" IN ('PREPARATION', 'EN_COURS', 'CLOTUREE'))
);
--> statement-breakpoint
CREATE TABLE "classe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"niveau_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"professeur_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classe_annee_nom_unique" UNIQUE("annee_scolaire_id","nom")
);
--> statement-breakpoint
CREATE TABLE "eleve" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matricule" text NOT NULL,
	"nom" text NOT NULL,
	"prenom" text NOT NULL,
	"date_naissance" date NOT NULL,
	"sexe" text NOT NULL,
	"statut" text DEFAULT 'ACTIF' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eleve_matricule_unique" UNIQUE("matricule"),
	CONSTRAINT "eleve_sexe" CHECK ("eleve"."sexe" IN ('F', 'M')),
	CONSTRAINT "eleve_statut" CHECK ("eleve"."statut" IN ('ACTIF', 'SORTI', 'TRANSFERE'))
);
--> statement-breakpoint
CREATE TABLE "enseignant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"prenom" text NOT NULL,
	"email" text NOT NULL,
	"telephone" text,
	"statut" text DEFAULT 'ACTIF' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enseignant_email_unique" UNIQUE("email"),
	CONSTRAINT "enseignant_statut" CHECK ("enseignant"."statut" IN ('ACTIF', 'INACTIF')),
	CONSTRAINT "enseignant_email_forme" CHECK ("enseignant"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+$')
);
--> statement-breakpoint
CREATE TABLE "etablissement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text NOT NULL,
	"adresse" text NOT NULL,
	"telephone" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"matiere_id" uuid NOT NULL,
	"classe_id" uuid NOT NULL,
	"enseignant_id" uuid NOT NULL,
	"periode_id" uuid NOT NULL,
	"type" text NOT NULL,
	"libelle" text NOT NULL,
	"date" date NOT NULL,
	"note_max" numeric(5, 2) NOT NULL,
	"coefficient" numeric(4, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluation_note_max_positive" CHECK ("evaluation"."note_max" > 0 AND "evaluation"."note_max" <= 100),
	CONSTRAINT "evaluation_coefficient_positif" CHECK ("evaluation"."coefficient" > 0),
	CONSTRAINT "evaluation_type" CHECK ("evaluation"."type" IN ('DEVOIR', 'COMPOSITION', 'INTERROGATION'))
);
--> statement-breakpoint
CREATE TABLE "inscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eleve_id" uuid NOT NULL,
	"classe_id" uuid NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"statut" text DEFAULT 'INSCRIT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inscription_eleve_annee_unique" UNIQUE("eleve_id","annee_scolaire_id"),
	CONSTRAINT "inscription_statut" CHECK ("inscription"."statut" IN ('INSCRIT', 'TRANSFERE', 'SORTI'))
);
--> statement-breakpoint
CREATE TABLE "matiere" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"nom" text NOT NULL,
	"coefficient" numeric(4, 2) NOT NULL,
	"niveau_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matiere_code_unique" UNIQUE("code"),
	CONSTRAINT "matiere_nom_unique" UNIQUE("nom"),
	CONSTRAINT "matiere_coefficient_positif" CHECK ("matiere"."coefficient" > 0)
);
--> statement-breakpoint
CREATE TABLE "niveau" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"nom" text NOT NULL,
	"ordre" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "niveau_code_unique" UNIQUE("code"),
	CONSTRAINT "niveau_ordre_unique" UNIQUE("ordre"),
	CONSTRAINT "niveau_ordre_positif" CHECK ("niveau"."ordre" > 0)
);
--> statement-breakpoint
CREATE TABLE "note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eleve_id" uuid NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"valeur" numeric(5, 2),
	"est_absent" boolean DEFAULT false NOT NULL,
	"commentaire" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_eleve_evaluation_unique" UNIQUE("eleve_id","evaluation_id"),
	CONSTRAINT "note_valeur_non_negative" CHECK ("note"."valeur" IS NULL OR "note"."valeur" >= 0),
	CONSTRAINT "note_absence_coherente" CHECK (("note"."est_absent" = true AND "note"."valeur" IS NULL) OR ("note"."est_absent" = false AND "note"."valeur" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "periode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"annee_scolaire_id" uuid NOT NULL,
	"libelle" text NOT NULL,
	"ordre" integer NOT NULL,
	"date_debut" date NOT NULL,
	"date_fin" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "periode_annee_ordre_unique" UNIQUE("annee_scolaire_id","ordre"),
	CONSTRAINT "periode_annee_libelle_unique" UNIQUE("annee_scolaire_id","libelle"),
	CONSTRAINT "periode_dates" CHECK ("periode"."date_fin" > "periode"."date_debut"),
	CONSTRAINT "periode_ordre_trimestre" CHECK ("periode"."ordre" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE TABLE "role" (
	"code" text PRIMARY KEY NOT NULL,
	"libelle" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utilisateur" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"mot_de_passe_hash" text NOT NULL,
	"role_code" text NOT NULL,
	"enseignant_id" uuid,
	"prenom" text NOT NULL,
	"nom" text NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "utilisateur_email_unique" UNIQUE("email"),
	CONSTRAINT "utilisateur_enseignant_unique" UNIQUE("enseignant_id"),
	CONSTRAINT "utilisateur_email_forme" CHECK ("utilisateur"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
	CONSTRAINT "utilisateur_role_enseignant_lie" CHECK ("utilisateur"."role_code" NOT IN ('ENSEIGNANT', 'PROFESSEUR_PRINCIPAL') OR "utilisateur"."enseignant_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "affectation_enseignant" ADD CONSTRAINT "affectation_enseignant_id_fk" FOREIGN KEY ("enseignant_id") REFERENCES "public"."enseignant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affectation_enseignant" ADD CONSTRAINT "affectation_classe_id_fk" FOREIGN KEY ("classe_id") REFERENCES "public"."classe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affectation_enseignant" ADD CONSTRAINT "affectation_matiere_id_fk" FOREIGN KEY ("matiere_id") REFERENCES "public"."matiere"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affectation_enseignant" ADD CONSTRAINT "affectation_annee_scolaire_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annee_scolaire"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annee_scolaire" ADD CONSTRAINT "annee_scolaire_etablissement_id_fk" FOREIGN KEY ("etablissement_id") REFERENCES "public"."etablissement"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classe" ADD CONSTRAINT "classe_annee_scolaire_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annee_scolaire"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classe" ADD CONSTRAINT "classe_niveau_id_fk" FOREIGN KEY ("niveau_id") REFERENCES "public"."niveau"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classe" ADD CONSTRAINT "classe_professeur_principal_id_fk" FOREIGN KEY ("professeur_principal_id") REFERENCES "public"."enseignant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_matiere_id_fk" FOREIGN KEY ("matiere_id") REFERENCES "public"."matiere"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_classe_id_fk" FOREIGN KEY ("classe_id") REFERENCES "public"."classe"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_enseignant_id_fk" FOREIGN KEY ("enseignant_id") REFERENCES "public"."enseignant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation" ADD CONSTRAINT "evaluation_periode_id_fk" FOREIGN KEY ("periode_id") REFERENCES "public"."periode"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscription" ADD CONSTRAINT "inscription_eleve_id_fk" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleve"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscription" ADD CONSTRAINT "inscription_classe_id_fk" FOREIGN KEY ("classe_id") REFERENCES "public"."classe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscription" ADD CONSTRAINT "inscription_annee_scolaire_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annee_scolaire"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matiere" ADD CONSTRAINT "matiere_niveau_id_fk" FOREIGN KEY ("niveau_id") REFERENCES "public"."niveau"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_eleve_id_fk" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleve"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_evaluation_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periode" ADD CONSTRAINT "periode_annee_scolaire_id_fk" FOREIGN KEY ("annee_scolaire_id") REFERENCES "public"."annee_scolaire"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_role_code_fk" FOREIGN KEY ("role_code") REFERENCES "public"."role"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_enseignant_id_fk" FOREIGN KEY ("enseignant_id") REFERENCES "public"."enseignant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_affectation_enseignant" ON "affectation_enseignant" USING btree ("enseignant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "annee_scolaire_une_en_cours" ON "annee_scolaire" USING btree ("etablissement_id") WHERE "annee_scolaire"."statut" = 'EN_COURS';--> statement-breakpoint
CREATE INDEX "idx_classe_annee" ON "classe" USING btree ("annee_scolaire_id");--> statement-breakpoint
CREATE INDEX "idx_eleve_nom" ON "eleve" USING btree ("nom","prenom");--> statement-breakpoint
CREATE INDEX "idx_evaluation_classe_periode" ON "evaluation" USING btree ("classe_id","periode_id");--> statement-breakpoint
CREATE INDEX "idx_evaluation_matiere" ON "evaluation" USING btree ("matiere_id");--> statement-breakpoint
CREATE INDEX "idx_evaluation_enseignant" ON "evaluation" USING btree ("enseignant_id");--> statement-breakpoint
CREATE INDEX "idx_inscription_classe" ON "inscription" USING btree ("classe_id");--> statement-breakpoint
CREATE INDEX "idx_inscription_eleve" ON "inscription" USING btree ("eleve_id");--> statement-breakpoint
CREATE INDEX "idx_note_eleve" ON "note" USING btree ("eleve_id");--> statement-breakpoint
CREATE INDEX "idx_note_evaluation" ON "note" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "idx_periode_annee" ON "periode" USING btree ("annee_scolaire_id");--> statement-breakpoint
CREATE INDEX "idx_utilisateur_role" ON "utilisateur" USING btree ("role_code");
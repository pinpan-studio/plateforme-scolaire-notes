CREATE TABLE "journal_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"acteur_id" uuid,
	"identifiant" text,
	"resultat" text NOT NULL,
	"adresse_ip" text,
	"action" text,
	"cible_type" text,
	"cible_id" uuid,
	"ancienne_valeur" text,
	"nouvelle_valeur" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_audit_type" CHECK ("journal_audit"."type" IN ('AUTH_SUCCES', 'AUTH_ECHEC', 'DECONNEXION', 'NOTE_CREATION', 'NOTE_MODIFICATION', 'NOTE_SUPPRESSION', 'NOTE_VALIDATION', 'AUTORISATION_REFUSEE'))
);
--> statement-breakpoint
ALTER TABLE "utilisateur" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_acteur_id_fk" FOREIGN KEY ("acteur_id") REFERENCES "public"."utilisateur"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_journal_audit_created" ON "journal_audit" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "utilisateur" ADD CONSTRAINT "utilisateur_session_version_non_negative" CHECK ("utilisateur"."session_version" >= 0);
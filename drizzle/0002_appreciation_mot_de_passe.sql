CREATE TABLE "appreciation_generale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"eleve_id" uuid NOT NULL,
	"periode_id" uuid NOT NULL,
	"texte" text NOT NULL,
	"auteur_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appreciation_generale_eleve_periode_unique" UNIQUE("eleve_id","periode_id")
);
--> statement-breakpoint
ALTER TABLE "appreciation_generale" ADD CONSTRAINT "appreciation_generale_eleve_id_fk" FOREIGN KEY ("eleve_id") REFERENCES "public"."eleve"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appreciation_generale" ADD CONSTRAINT "appreciation_generale_periode_id_fk" FOREIGN KEY ("periode_id") REFERENCES "public"."periode"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appreciation_generale" ADD CONSTRAINT "appreciation_generale_auteur_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateur"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_audit" DROP CONSTRAINT "journal_audit_type";--> statement-breakpoint
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_type" CHECK ("journal_audit"."type" IN ('AUTH_SUCCES', 'AUTH_ECHEC', 'DECONNEXION', 'NOTE_CREATION', 'NOTE_MODIFICATION', 'NOTE_SUPPRESSION', 'NOTE_VALIDATION', 'AUTORISATION_REFUSEE', 'MOT_DE_PASSE'));

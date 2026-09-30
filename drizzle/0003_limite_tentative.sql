-- Compteurs de tentatives partagés (connexion, mot de passe, validation de notes).
-- Rollback : DROP TABLE "limite_tentative";
CREATE TABLE IF NOT EXISTS "limite_tentative" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portee" text NOT NULL,
	"cle" text NOT NULL,
	"sujet" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "limite_tentative_portee" CHECK ("limite_tentative"."portee" IN ('connexion_email', 'connexion_ip', 'mot_de_passe_sujet', 'mot_de_passe_ip', 'validation_sujet', 'validation_ip'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_limite_tentative_cle" ON "limite_tentative" USING btree ("portee","cle","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_limite_tentative_sujet" ON "limite_tentative" USING btree ("portee","sujet");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_limite_tentative_created" ON "limite_tentative" USING btree ("created_at");

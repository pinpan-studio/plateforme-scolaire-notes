-- Étend les types du journal d'audit (utilisateur, affectation, barème, état d'année).
-- Numéro 0004, idx 4 : 0003 (limiteur de tentatives, idx 3) est déjà pris.
-- when 1790800000000, strictement postérieur à 0002 (1790692000000) et à 0003 (1790763824949).
-- Rollback :
--   ALTER TABLE "journal_audit" DROP CONSTRAINT "journal_audit_type";
--   ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_type" CHECK ("journal_audit"."type" IN ('AUTH_SUCCES', 'AUTH_ECHEC', 'DECONNEXION', 'NOTE_CREATION', 'NOTE_MODIFICATION', 'NOTE_SUPPRESSION', 'NOTE_VALIDATION', 'AUTORISATION_REFUSEE', 'MOT_DE_PASSE'));
ALTER TABLE "journal_audit" DROP CONSTRAINT "journal_audit_type";
--> statement-breakpoint
ALTER TABLE "journal_audit" ADD CONSTRAINT "journal_audit_type" CHECK ("journal_audit"."type" IN ('AUTH_SUCCES', 'AUTH_ECHEC', 'DECONNEXION', 'NOTE_CREATION', 'NOTE_MODIFICATION', 'NOTE_SUPPRESSION', 'NOTE_VALIDATION', 'AUTORISATION_REFUSEE', 'MOT_DE_PASSE', 'UTILISATEUR_CREATION', 'UTILISATEUR_MODIFICATION', 'AFFECTATION_CREATION', 'AFFECTATION_SUPPRESSION', 'BAREME_MODIFICATION', 'ANNEE_STATUT'));

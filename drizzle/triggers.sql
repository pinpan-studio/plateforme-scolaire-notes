-- Triggers d'intégrité métier.
-- Appliqués par `npm run db:migrate` après les migrations Drizzle.
-- Idempotents : CREATE OR REPLACE et DROP TRIGGER IF EXISTS.
--
-- Choix : une note ne doit pas dépasser evaluation.note_max. Un CHECK PostgreSQL
-- ne peut pas lire une autre table. Un trigger BEFORE INSERT OR UPDATE lit le
-- barème au moment de l'écriture. ERRCODE 23514 pour le rapprocher d'un CHECK.
-- Copier note_max sur la ligne de note a été écarté : la valeur dériverait si
-- le barème de l'évaluation était corrigé.

-- statement-breakpoint
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- statement-breakpoint
DO $$
DECLARE
  nom text;
BEGIN
  FOREACH nom IN ARRAY ARRAY[
    'role',
    'etablissement',
    'annee_scolaire',
    'niveau',
    'enseignant',
    'classe',
    'eleve',
    'matiere',
    'affectation_enseignant',
    'periode',
    'inscription',
    'evaluation',
    'note',
    'utilisateur'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_' || nom || '_updated_at', nom);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      'trg_' || nom || '_updated_at',
      nom
    );
  END LOOP;
END;
$$;

-- statement-breakpoint
CREATE OR REPLACE FUNCTION eleve_verifier_naissance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.date_naissance >= CURRENT_DATE THEN
    RAISE EXCEPTION 'date_naissance_future'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- statement-breakpoint
DROP TRIGGER IF EXISTS trg_eleve_naissance ON eleve;
CREATE TRIGGER trg_eleve_naissance
  BEFORE INSERT OR UPDATE OF date_naissance ON eleve
  FOR EACH ROW EXECUTE FUNCTION eleve_verifier_naissance();

-- statement-breakpoint
CREATE OR REPLACE FUNCTION periode_verifier_bornes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  debut date;
  fin date;
BEGIN
  SELECT date_debut, date_fin INTO debut, fin
  FROM annee_scolaire
  WHERE id = NEW.annee_scolaire_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.date_debut < debut OR NEW.date_fin > fin THEN
    RAISE EXCEPTION 'periode_hors_annee'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- statement-breakpoint
DROP TRIGGER IF EXISTS trg_periode_bornes ON periode;
CREATE TRIGGER trg_periode_bornes
  BEFORE INSERT OR UPDATE ON periode
  FOR EACH ROW EXECUTE FUNCTION periode_verifier_bornes();

-- statement-breakpoint
CREATE OR REPLACE FUNCTION affectation_verifier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  annee_classe uuid;
  niveau_classe uuid;
  niveau_matiere uuid;
BEGIN
  SELECT annee_scolaire_id, niveau_id
    INTO annee_classe, niveau_classe
  FROM classe
  WHERE id = NEW.classe_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF annee_classe IS DISTINCT FROM NEW.annee_scolaire_id THEN
    RAISE EXCEPTION 'affectation_annee_incoherente'
      USING ERRCODE = '23514';
  END IF;

  SELECT niveau_id INTO niveau_matiere FROM matiere WHERE id = NEW.matiere_id;
  IF niveau_matiere IS NOT NULL AND niveau_matiere IS DISTINCT FROM niveau_classe THEN
    RAISE EXCEPTION 'affectation_niveau_incoherent'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- statement-breakpoint
DROP TRIGGER IF EXISTS trg_affectation_verifier ON affectation_enseignant;
CREATE TRIGGER trg_affectation_verifier
  BEFORE INSERT OR UPDATE ON affectation_enseignant
  FOR EACH ROW EXECUTE FUNCTION affectation_verifier();

-- statement-breakpoint
CREATE OR REPLACE FUNCTION inscription_verifier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  annee_classe uuid;
BEGIN
  SELECT annee_scolaire_id INTO annee_classe FROM classe WHERE id = NEW.classe_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF annee_classe IS DISTINCT FROM NEW.annee_scolaire_id THEN
    RAISE EXCEPTION 'inscription_annee_incoherente'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- statement-breakpoint
DROP TRIGGER IF EXISTS trg_inscription_verifier ON inscription;
CREATE TRIGGER trg_inscription_verifier
  BEFORE INSERT OR UPDATE ON inscription
  FOR EACH ROW EXECUTE FUNCTION inscription_verifier();

-- statement-breakpoint
CREATE OR REPLACE FUNCTION evaluation_verifier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  annee_periode uuid;
  debut date;
  fin date;
  annee_classe uuid;
BEGIN
  SELECT annee_scolaire_id, date_debut, date_fin
    INTO annee_periode, debut, fin
  FROM periode
  WHERE id = NEW.periode_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.date < debut OR NEW.date > fin THEN
    RAISE EXCEPTION 'evaluation_hors_periode'
      USING ERRCODE = '23514';
  END IF;

  SELECT annee_scolaire_id INTO annee_classe FROM classe WHERE id = NEW.classe_id;
  IF FOUND AND annee_classe IS DISTINCT FROM annee_periode THEN
    RAISE EXCEPTION 'evaluation_classe_autre_annee'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM enseignant WHERE id = NEW.enseignant_id)
     AND EXISTS (SELECT 1 FROM classe WHERE id = NEW.classe_id)
     AND EXISTS (SELECT 1 FROM matiere WHERE id = NEW.matiere_id)
     AND NOT EXISTS (
       SELECT 1
       FROM affectation_enseignant a
       WHERE a.enseignant_id = NEW.enseignant_id
         AND a.classe_id = NEW.classe_id
         AND a.matiere_id = NEW.matiere_id
         AND a.annee_scolaire_id = annee_periode
     ) THEN
    RAISE EXCEPTION 'evaluation_sans_affectation'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- statement-breakpoint
DROP TRIGGER IF EXISTS trg_evaluation_verifier ON evaluation;
CREATE TRIGGER trg_evaluation_verifier
  BEFORE INSERT OR UPDATE ON evaluation
  FOR EACH ROW EXECUTE FUNCTION evaluation_verifier();

-- statement-breakpoint
CREATE OR REPLACE FUNCTION note_verifier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_note_max numeric;
  v_classe uuid;
BEGIN
  SELECT note_max, classe_id INTO v_note_max, v_classe
  FROM evaluation
  WHERE id = NEW.evaluation_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.valeur IS NOT NULL AND NEW.valeur > v_note_max THEN
    RAISE EXCEPTION 'note_depasse_maximum: % > %', NEW.valeur, v_note_max
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM eleve WHERE id = NEW.eleve_id) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM inscription i
    WHERE i.eleve_id = NEW.eleve_id
      AND i.classe_id = v_classe
      AND i.statut = 'INSCRIT'
  ) THEN
    RAISE EXCEPTION 'note_eleve_non_inscrit'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- statement-breakpoint
DROP TRIGGER IF EXISTS trg_note_verifier ON note;
CREATE TRIGGER trg_note_verifier
  BEFORE INSERT OR UPDATE OF valeur, evaluation_id, eleve_id, est_absent ON note
  FOR EACH ROW EXECUTE FUNCTION note_verifier();

-- statement-breakpoint
CREATE OR REPLACE FUNCTION utilisateur_pp_verifier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role_code = 'PROFESSEUR_PRINCIPAL' AND NOT EXISTS (
    SELECT 1 FROM classe c WHERE c.professeur_principal_id = NEW.enseignant_id
  ) THEN
    RAISE EXCEPTION 'pp_sans_classe'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- statement-breakpoint
DROP TRIGGER IF EXISTS trg_utilisateur_pp ON utilisateur;
CREATE CONSTRAINT TRIGGER trg_utilisateur_pp
  AFTER INSERT OR UPDATE OF role_code, enseignant_id ON utilisateur
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION utilisateur_pp_verifier();

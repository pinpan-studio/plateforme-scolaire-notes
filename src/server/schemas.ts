import { z } from "zod";
import { validationError } from "./errors";

const requis = "Champ requis.";

export const uuidSchema = z.uuid("Identifiant invalide.");

const texte = (min: number, max: number, label: string) =>
  z
    .string({ error: `${label} est requis.` })
    .trim()
    .min(min, min === 1 ? `${label} est requis.` : `${label} est trop court.`)
    .max(max, `${label} est trop long.`);

function decimales(value: number, max: number) {
  if (!Number.isFinite(value)) return false;
  const factor = 10 ** max;
  return Math.abs(value * factor - Math.round(value * factor)) < 1e-6;
}

const dateIso = z
  .string({ error: "Date requise." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, "Date invalide.");

const coefficient = z
  .number({ error: "Nombre attendu." })
  .positive("Le coefficient doit être strictement positif.")
  .refine((value) => decimales(value, 2), "Au plus 2 décimales.");

const email = z
  .string({ error: "E-mail requis." })
  .trim()
  .toLowerCase()
  .max(200, "E-mail trop long.")
  .email("E-mail invalide.");

const motDePasse = z
  .string({ error: "Mot de passe requis." })
  .min(12, "Le mot de passe contient au moins 12 caractères.")
  .max(200, "Mot de passe trop long.");

const motDePasseConnexion = z
  .string({ error: "Mot de passe requis." })
  .min(1, "Mot de passe requis.")
  .max(200, "Mot de passe trop long.");

export const loginSchema = z
  .object({
    email,
    motDePasse: motDePasseConnexion,
  })
  .strict();

export const createEleveSchema = z
  .object({
    matricule: z
      .string({ error: requis })
      .trim()
      .toUpperCase()
      .min(4, "Le matricule contient au moins 4 caractères.")
      .max(32, "Le matricule contient au plus 32 caractères."),
    nom: texte(1, 80, "Le nom"),
    prenom: texte(1, 80, "Le prénom"),
    dateNaissance: dateIso,
    sexe: z.enum(["F", "M"], { error: "Sexe invalide." }),
    classeId: uuidSchema,
    statut: z.enum(["ACTIF", "SORTI", "TRANSFERE"]).optional(),
  })
  .strict();

export const patchEleveSchema = z
  .object({
    nom: texte(1, 80, "Le nom").optional(),
    prenom: texte(1, 80, "Le prénom").optional(),
    dateNaissance: dateIso.optional(),
    sexe: z.enum(["F", "M"], { error: "Sexe invalide." }).optional(),
    statut: z.enum(["ACTIF", "SORTI", "TRANSFERE"]).optional(),
    classeId: uuidSchema.optional(),
    version: z.string().optional(),
  })
  .strict();

export const createClasseSchema = z
  .object({
    nom: texte(1, 40, "Le nom"),
    niveauId: uuidSchema,
    anneeScolaireId: uuidSchema,
    professeurPrincipalId: uuidSchema.nullable().optional(),
  })
  .strict();

export const patchClasseSchema = z
  .object({
    nom: texte(1, 40, "Le nom").optional(),
    niveauId: uuidSchema.optional(),
    professeurPrincipalId: uuidSchema.nullable().optional(),
  })
  .strict();

export const inscriptionSchema = z
  .object({
    eleveId: uuidSchema,
    statut: z.enum(["INSCRIT", "TRANSFERE", "SORTI"]).optional(),
  })
  .strict();

export const createMatiereSchema = z
  .object({
    code: z
      .string({ error: requis })
      .trim()
      .toUpperCase()
      .min(1, "Le code est requis.")
      .max(16, "Le code est trop long."),
    nom: texte(1, 80, "Le nom"),
    coefficient,
    niveauId: uuidSchema.nullable().optional(),
  })
  .strict();

export const patchMatiereSchema = createMatiereSchema.partial().strict();

export const createEnseignantSchema = z
  .object({
    nom: texte(1, 80, "Le nom"),
    prenom: texte(1, 80, "Le prénom"),
    email,
    telephone: z.string().trim().max(30, "Téléphone trop long.").nullable().optional(),
    statut: z.enum(["ACTIF", "INACTIF"]).optional(),
  })
  .strict();

export const patchEnseignantSchema = createEnseignantSchema.partial().strict();

export const createAffectationSchema = z
  .object({
    enseignantId: uuidSchema,
    classeId: uuidSchema,
    matiereId: uuidSchema,
  })
  .strict();

export const createAnneeSchema = z
  .object({
    libelle: texte(1, 20, "Le libellé"),
    dateDebut: dateIso,
    dateFin: dateIso,
    statut: z.enum(["PREPARATION", "EN_COURS", "CLOTUREE"]).optional(),
  })
  .strict()
  .refine((value) => value.dateFin > value.dateDebut, {
    path: ["dateFin"],
    message: "La fin est postérieure au début.",
  });

export const patchAnneeSchema = z
  .object({
    libelle: texte(1, 20, "Le libellé").optional(),
    dateDebut: dateIso.optional(),
    dateFin: dateIso.optional(),
    statut: z.enum(["PREPARATION", "EN_COURS", "CLOTUREE"]).optional(),
  })
  .strict();

export const createPeriodeSchema = z
  .object({
    anneeScolaireId: uuidSchema,
    libelle: texte(1, 40, "Le libellé"),
    ordre: z.number({ error: "Nombre attendu." }).int().min(1).max(3),
    dateDebut: dateIso,
    dateFin: dateIso,
  })
  .strict()
  .refine((value) => value.dateFin > value.dateDebut, {
    path: ["dateFin"],
    message: "La fin est postérieure au début.",
  });

export const patchPeriodeSchema = z
  .object({
    libelle: texte(1, 40, "Le libellé").optional(),
    ordre: z.number({ error: "Nombre attendu." }).int().min(1).max(3).optional(),
    dateDebut: dateIso.optional(),
    dateFin: dateIso.optional(),
  })
  .strict();

export const patchEtablissementSchema = z
  .object({
    nom: texte(1, 120, "Le nom").optional(),
    adresse: texte(1, 200, "L'adresse").optional(),
    telephone: texte(1, 30, "Le téléphone").optional(),
    email,
  })
  .partial()
  .strict();

const noteValeur = z
  .number({ error: "Nombre attendu." })
  .min(0, "La note ne peut pas être négative.")
  .refine((value) => decimales(value, 2), "Au plus 2 décimales.");

export const noteLigneSchema = z
  .object({
    evaluationId: uuidSchema.optional(),
    eleveId: uuidSchema,
    valeur: noteValeur.nullable(),
    estAbsent: z.boolean({ error: "Présence ou absence requise." }),
    commentaire: z.string().trim().max(500, "Commentaire trop long.").nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.estAbsent && value.valeur !== null) {
      ctx.addIssue({ code: "custom", path: ["valeur"], message: "Une absence n'a pas de valeur numérique." });
    }
    if (!value.estAbsent && value.valeur === null) {
      ctx.addIssue({ code: "custom", path: ["valeur"], message: "Une présence doit avoir une valeur." });
    }
  });

export const createNoteSchema = z
  .object({
    evaluationId: uuidSchema,
    eleveId: uuidSchema,
    valeur: noteValeur.nullable(),
    estAbsent: z.boolean({ error: "Présence ou absence requise." }),
    commentaire: z.string().trim().max(500, "Commentaire trop long.").nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.estAbsent && value.valeur !== null) {
      ctx.addIssue({ code: "custom", path: ["valeur"], message: "Une absence n'a pas de valeur numérique." });
    }
    if (!value.estAbsent && value.valeur === null) {
      ctx.addIssue({ code: "custom", path: ["valeur"], message: "Une présence doit avoir une valeur." });
    }
  });

export const patchNoteSchema = z
  .object({
    valeur: noteValeur.nullable().optional(),
    estAbsent: z.boolean().optional(),
    commentaire: z.string().trim().max(500, "Commentaire trop long.").nullable().optional(),
    version: z.string().optional(),
  })
  .strict();

export const lotNotesSchema = z
  .object({
    evaluationId: uuidSchema.optional(),
    lignes: z.array(noteLigneSchema).min(1, "Au moins une ligne.").max(200, "Lot trop volumineux."),
  })
  .strict();

export const createEvaluationSchema = z
  .object({
    classeId: uuidSchema,
    matiereId: uuidSchema,
    periodeId: uuidSchema,
    enseignantId: uuidSchema.optional(),
    type: z.enum(["DEVOIR", "COMPOSITION", "INTERROGATION"], { error: "Type d'évaluation invalide." }),
    libelle: texte(1, 120, "Le libellé"),
    date: dateIso,
    noteMax: z
      .number({ error: "Nombre attendu." })
      .positive("La note maximale doit être strictement positive.")
      .max(100, "La note maximale est au plus 100.")
      .refine((value) => decimales(value, 2), "Au plus 2 décimales."),
    coefficient,
  })
  .strict();

export const patchEvaluationSchema = createEvaluationSchema.partial().strict();

export const createUtilisateurSchema = z
  .object({
    email,
    motDePasse,
    roleCode: z.enum(["ADMIN", "DIRECTION", "ENSEIGNANT", "PROFESSEUR_PRINCIPAL", "CONSULTATION"]),
    enseignantId: uuidSchema.nullable().optional(),
    prenom: texte(1, 80, "Le prénom"),
    nom: texte(1, 80, "Le nom"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.roleCode === "ENSEIGNANT" || value.roleCode === "PROFESSEUR_PRINCIPAL") && !value.enseignantId) {
      ctx.addIssue({
        code: "custom",
        path: ["enseignantId"],
        message: "Ce rôle doit être lié à un enseignant.",
      });
    }
  });

export const patchUtilisateurSchema = z
  .object({
    email: email.optional(),
    prenom: texte(1, 80, "Le prénom").optional(),
    nom: texte(1, 80, "Le nom").optional(),
    actif: z.boolean().optional(),
    roleCode: z.enum(["ADMIN", "DIRECTION", "ENSEIGNANT", "PROFESSEUR_PRINCIPAL", "CONSULTATION"]).optional(),
    enseignantId: uuidSchema.nullable().optional(),
    motDePasse: motDePasse.optional(),
    motDePasseActuel: z.string().optional(),
  })
  .strict();

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

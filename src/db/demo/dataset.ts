import { DEMO_PASSWORD_HASH } from "../demo-password";

export const PRENOMS_F = [
  "Camille",
  "Léa",
  "Chloé",
  "Inès",
  "Manon",
  "Jade",
  "Louise",
  "Emma",
  "Alice",
  "Lina",
  "Rose",
  "Anna",
  "Julia",
  "Léna",
  "Sarah",
  "Eva",
  "Nina",
  "Zoé",
  "Mia",
  "Lola",
  "Iris",
  "Agathe",
  "Clara",
  "Elise",
  "Margot",
  "Noémie",
  "Capucine",
  "Apolline",
] as const;

export const PRENOMS_M = [
  "Hugo",
  "Louis",
  "Adam",
  "Nathan",
  "Jules",
  "Gabriel",
  "Raphaël",
  "Arthur",
  "Ethan",
  "Tom",
  "Noah",
  "Sacha",
  "Maël",
  "Paul",
  "Eden",
  "Naël",
  "Théo",
  "Léon",
  "Victor",
  "Simon",
  "Axel",
  "Eliott",
  "Marceau",
  "Augustin",
  "Basile",
  "César",
  "Damien",
  "Émile",
] as const;

export const NOMS = [
  "Martin",
  "Bernard",
  "Dubois",
  "Thomas",
  "Robert",
  "Richard",
  "Petit",
  "Durand",
  "Leroy",
  "Moreau",
  "Simon",
  "Laurent",
  "Lefebvre",
  "Michel",
  "Garcia",
  "David",
  "Bertrand",
  "Roux",
  "Vincent",
  "Fournier",
  "Morel",
  "Girard",
  "Andre",
  "Mercier",
  "Dupont",
  "Lambert",
  "Bonnet",
  "Francois",
  "Martinez",
  "Legrand",
  "Garnier",
  "Faure",
  "Rousseau",
  "Blanc",
  "Guerin",
  "Muller",
  "Henry",
  "Roussel",
  "Nicolas",
  "Perrin",
  "Morin",
  "Mathieu",
  "Clement",
  "Gauthier",
  "Dumont",
  "Lopez",
  "Fontaine",
  "Chevalier",
  "Robin",
  "Meyer",
  "Blanchard",
  "Colin",
  "Barbier",
  "Vidal",
  "Joly",
  "Marchand",
] as const;

const BASE_SUR_VINGT = [6, 7.5, 8.5, 9.5, 10.5, 11, 12, 12.5, 13, 13.5, 14.5, 16, 17.5, 12];
const SPREAD = [1.5, 1.5, 1.2, 1.2, 1.2, 1, 1, 1, 1, 1.2, 1, 0.8, 0.6, 3.5];

type EvalPlan = {
  type: "DEVOIR" | "COMPOSITION" | "INTERROGATION";
  coefficient: number;
  noteMax: number;
  jour: number;
  libelle: string;
};

const EVALUATIONS_PAR_TRIMESTRE: Record<number, EvalPlan[]> = {
  1: [
    { type: "DEVOIR", coefficient: 1, noteMax: 20, jour: 21, libelle: "Devoir" },
    { type: "COMPOSITION", coefficient: 2, noteMax: 20, jour: 70, libelle: "Composition" },
  ],
  2: [
    { type: "DEVOIR", coefficient: 1, noteMax: 20, jour: 21, libelle: "Devoir" },
    { type: "INTERROGATION", coefficient: 1, noteMax: 10, jour: 40, libelle: "Interrogation" },
    { type: "COMPOSITION", coefficient: 2, noteMax: 20, jour: 70, libelle: "Composition" },
  ],
  3: [
    { type: "DEVOIR", coefficient: 1, noteMax: 20, jour: 21, libelle: "Devoir" },
    { type: "COMPOSITION", coefficient: 2, noteMax: 20, jour: 70, libelle: "Composition" },
  ],
};

export type DemoDataset = ReturnType<typeof buildDemoDataset>;

function createIds() {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

function mulberry32(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function subjectShift(code: string, position: number): number {
  if (code === "MATH" && position <= 3) return -2;
  if (code === "FR" && position <= 1) return -1;
  if (code === "FR" && position >= 11) return 1;
  if (code === "ANG" && position % 3 === 0) return -1.5;
  if (code === "EPS" && position <= 2) return 3;
  if (code === "ART" && position >= 11) return 1.5;
  if (code === "PC" && position === 13) return -3;
  return 0;
}

type TeacherKey =
  | "camille"
  | "hugo"
  | "lea"
  | "louis"
  | "chloe"
  | "adam"
  | "ines"
  | "nathan"
  | "manon"
  | "jules";

function teacherKey(matiereCode: string, classeNom: string): TeacherKey {
  const secondCycle = classeNom === "4e A" || classeNom === "3e A";
  if (matiereCode === "FR") return secondCycle ? "hugo" : "camille";
  if (matiereCode === "MATH") return secondCycle ? "louis" : "lea";
  if (matiereCode === "HG") return "chloe";
  if (matiereCode === "ANG") return "adam";
  if (matiereCode === "SVT") return "ines";
  if (matiereCode === "PC") return "nathan";
  if (matiereCode === "EPS") return "manon";
  return "jules";
}

export function buildDemoDataset() {
  const id = createIds();
  const rng = mulberry32(20250929);

  const etablissement = {
    id: id(),
    nom: "Collège Les Tilleuls",
    adresse: "12 rue des Écoles, 69001 Lyon",
    telephone: "04 72 00 00 01",
    email: "contact@tilleuls.demo",
  };

  const anneePrecedente = {
    id: id(),
    etablissementId: etablissement.id,
    libelle: "2024-2025",
    dateDebut: "2024-09-02",
    dateFin: "2025-07-04",
    statut: "CLOTUREE" as const,
  };
  const anneeCourante = {
    id: id(),
    etablissementId: etablissement.id,
    libelle: "2025-2026",
    dateDebut: "2025-09-01",
    dateFin: "2026-07-03",
    statut: "EN_COURS" as const,
  };

  const niveauxSource = [
    { code: "6e", nom: "Sixième", ordre: 1 },
    { code: "5e", nom: "Cinquième", ordre: 2 },
    { code: "4e", nom: "Quatrième", ordre: 3 },
    { code: "3e", nom: "Troisième", ordre: 4 },
  ];
  const niveaux = niveauxSource.map((niveau) => ({ id: id(), ...niveau }));
  const niveauParCode = new Map(niveaux.map((niveau) => [niveau.code, niveau]));

  const periodesSource = [
    { annee: anneePrecedente, ordre: 1, libelle: "Trimestre 1", dateDebut: "2024-09-02", dateFin: "2024-12-06" },
    { annee: anneePrecedente, ordre: 2, libelle: "Trimestre 2", dateDebut: "2025-01-06", dateFin: "2025-03-28" },
    { annee: anneePrecedente, ordre: 3, libelle: "Trimestre 3", dateDebut: "2025-04-14", dateFin: "2025-07-04" },
    { annee: anneeCourante, ordre: 1, libelle: "Trimestre 1", dateDebut: "2025-09-01", dateFin: "2025-12-05" },
    { annee: anneeCourante, ordre: 2, libelle: "Trimestre 2", dateDebut: "2026-01-05", dateFin: "2026-03-27" },
    { annee: anneeCourante, ordre: 3, libelle: "Trimestre 3", dateDebut: "2026-04-13", dateFin: "2026-07-03" },
  ];
  const periodes = periodesSource.map((periode) => ({
    id: id(),
    anneeScolaireId: periode.annee.id,
    libelle: periode.libelle,
    ordre: periode.ordre,
    dateDebut: periode.dateDebut,
    dateFin: periode.dateFin,
  }));

  const enseignantsSource = [
    { key: "camille", prenom: "Camille", nom: "Martin" },
    { key: "hugo", prenom: "Hugo", nom: "Bernard" },
    { key: "lea", prenom: "Léa", nom: "Dubois" },
    { key: "louis", prenom: "Louis", nom: "Thomas" },
    { key: "chloe", prenom: "Chloé", nom: "Robert" },
    { key: "adam", prenom: "Adam", nom: "Richard" },
    { key: "ines", prenom: "Inès", nom: "Petit" },
    { key: "nathan", prenom: "Nathan", nom: "Durand" },
    { key: "manon", prenom: "Manon", nom: "Leroy" },
    { key: "jules", prenom: "Jules", nom: "Moreau" },
  ] as const;
  const enseignants = enseignantsSource.map((enseignant, index) => ({
    id: id(),
    key: enseignant.key,
    nom: enseignant.nom,
    prenom: enseignant.prenom,
    email: `${enseignant.key}.${enseignant.nom.toLowerCase()}@tilleuls.demo`,
    telephone: `06 12 00 ${String(index + 1).padStart(2, "0")} 00`,
    statut: "ACTIF" as const,
  }));
  const enseignantParCle = new Map(enseignants.map((enseignant) => [enseignant.key, enseignant]));

  const matieresSource = [
    { code: "FR", nom: "Français", coefficient: 4 },
    { code: "MATH", nom: "Mathématiques", coefficient: 4 },
    { code: "HG", nom: "Histoire-Géographie", coefficient: 3 },
    { code: "ANG", nom: "Anglais", coefficient: 3 },
    { code: "SVT", nom: "Sciences de la vie et de la Terre", coefficient: 2 },
    { code: "PC", nom: "Physique-Chimie", coefficient: 2 },
    { code: "EPS", nom: "Éducation physique et sportive", coefficient: 1 },
    { code: "ART", nom: "Arts plastiques", coefficient: 1 },
  ];
  const matieres = matieresSource.map((matiere) => ({
    id: id(),
    code: matiere.code,
    nom: matiere.nom,
    coefficient: matiere.coefficient,
    niveauId: null as string | null,
  }));

  const classesSource = [
    { nom: "6e A", niveau: "6e", pp: "camille" },
    { nom: "5e A", niveau: "5e", pp: "lea" },
    { nom: "4e A", niveau: "4e", pp: "hugo" },
    { nom: "3e A", niveau: "3e", pp: "adam" },
  ] as const;
  const classes = classesSource.map((classe) => ({
    id: id(),
    anneeScolaireId: anneeCourante.id,
    niveauId: niveauParCode.get(classe.niveau)!.id,
    nom: classe.nom,
    niveauCode: classe.niveau,
    professeurPrincipalId: enseignantParCle.get(classe.pp)!.id,
  }));

  const affectations = classes.flatMap((classe) =>
    matieres.map((matiere) => ({
      id: id(),
      enseignantId: enseignantParCle.get(teacherKey(matiere.code, classe.nom))!.id,
      classeId: classe.id,
      matiereId: matiere.id,
      anneeScolaireId: anneeCourante.id,
    })),
  );

  const anneesNaissance: Record<string, number> = { "6e": 2014, "5e": 2013, "4e": 2012, "3e": 2011 };
  const eleves = Array.from({ length: 56 }, (_, index) => {
    const classe = classes[Math.floor(index / 14)];
    const sexe = index % 2 === 0 ? "F" : "M";
    const prenom = sexe === "F" ? PRENOMS_F[index / 2] : PRENOMS_M[(index / 2) | 0];
    const mois = String((index % 12) + 1).padStart(2, "0");
    const jour = String((index % 27) + 1).padStart(2, "0");
    return {
      id: id(),
      matricule: `EL-2026-${String(index + 1).padStart(3, "0")}`,
      nom: NOMS[index],
      prenom,
      dateNaissance: `${anneesNaissance[classe.niveauCode]}-${mois}-${jour}`,
      sexe,
      statut: "ACTIF" as const,
      classeId: classe.id,
      position: index % 14,
    };
  });

  const inscriptions = eleves.map((eleve) => ({
    id: id(),
    eleveId: eleve.id,
    classeId: eleve.classeId,
    anneeScolaireId: anneeCourante.id,
    statut: "INSCRIT" as const,
  }));

  const periodesCourantes = periodes.filter((periode) => periode.anneeScolaireId === anneeCourante.id);
  const evaluations: Array<{
    id: string;
    matiereId: string;
    classeId: string;
    enseignantId: string;
    periodeId: string;
    type: EvalPlan["type"];
    libelle: string;
    date: string;
    noteMax: number;
    coefficient: number;
  }> = [];
  const notes: Array<{
    id: string;
    eleveId: string;
    evaluationId: string;
    valeur: number | null;
    estAbsent: boolean;
    commentaire: string | null;
  }> = [];

  for (const classe of classes) {
    const elevesClasse = eleves.filter((eleve) => eleve.classeId === classe.id);
    for (const matiere of matieres) {
      const enseignantId = enseignantParCle.get(teacherKey(matiere.code, classe.nom))!.id;
      for (const periode of periodesCourantes) {
        for (const plan of EVALUATIONS_PAR_TRIMESTRE[periode.ordre]) {
          const date = addDays(periode.dateDebut, plan.jour);
          if (date < periode.dateDebut || date > periode.dateFin) {
            throw new Error(`Date d'évaluation hors période : ${date} (${periode.libelle})`);
          }
          const evaluation = {
            id: id(),
            matiereId: matiere.id,
            classeId: classe.id,
            enseignantId,
            periodeId: periode.id,
            type: plan.type,
            libelle: `${plan.libelle} — ${periode.libelle}`,
            date,
            noteMax: plan.noteMax,
            coefficient: plan.coefficient,
          };
          evaluations.push(evaluation);

          for (const eleve of elevesClasse) {
            const absentRate = eleve.position <= 1 ? 0.1 : eleve.position >= 11 ? 0.02 : 0.04;
            const absent = rng() < absentRate;
            const noise = (rng() * 2 - 1) * SPREAD[eleve.position];
            if (absent) {
              notes.push({
                id: id(),
                eleveId: eleve.id,
                evaluationId: evaluation.id,
                valeur: null,
                estAbsent: true,
                commentaire: "Absent à l'évaluation",
              });
              continue;
            }

            const surVingt = clamp(
              BASE_SUR_VINGT[eleve.position] + subjectShift(matiere.code, eleve.position) + noise,
              0,
              20,
            );
            const valeur = clamp(roundHalf((surVingt / 20) * plan.noteMax), 0, plan.noteMax);
            notes.push({
              id: id(),
              eleveId: eleve.id,
              evaluationId: evaluation.id,
              valeur,
              estAbsent: false,
              commentaire: valeur < 8 ? "À consolider" : null,
            });
          }
        }
      }
    }
  }

  const roles = [
    { code: "ADMIN", libelle: "Administrateur" },
    { code: "DIRECTION", libelle: "Direction" },
    { code: "ENSEIGNANT", libelle: "Enseignant" },
    { code: "PROFESSEUR_PRINCIPAL", libelle: "Professeur principal" },
    { code: "CONSULTATION", libelle: "Consultation" },
  ];

  const camille = enseignantParCle.get("camille")!;
  const nathan = enseignantParCle.get("nathan")!;
  const utilisateurs = [
    {
      id: id(),
      email: "admin@tilleuls.demo",
      motDePasseHash: DEMO_PASSWORD_HASH,
      roleCode: "ADMIN",
      enseignantId: null as string | null,
      prenom: "Alex",
      nom: "Admin",
      actif: true,
    },
    {
      id: id(),
      email: "direction@tilleuls.demo",
      motDePasseHash: DEMO_PASSWORD_HASH,
      roleCode: "DIRECTION",
      enseignantId: null,
      prenom: "Dominique",
      nom: "Direction",
      actif: true,
    },
    {
      id: id(),
      email: nathan.email,
      motDePasseHash: DEMO_PASSWORD_HASH,
      roleCode: "ENSEIGNANT",
      enseignantId: nathan.id,
      prenom: nathan.prenom,
      nom: nathan.nom,
      actif: true,
    },
    {
      id: id(),
      email: camille.email,
      motDePasseHash: DEMO_PASSWORD_HASH,
      roleCode: "PROFESSEUR_PRINCIPAL",
      enseignantId: camille.id,
      prenom: camille.prenom,
      nom: camille.nom,
      actif: true,
    },
    {
      id: id(),
      email: "consultation@tilleuls.demo",
      motDePasseHash: DEMO_PASSWORD_HASH,
      roleCode: "CONSULTATION",
      enseignantId: null,
      prenom: "Charlie",
      nom: "Consultation",
      actif: true,
    },
  ];

  return {
    etablissement,
    annees: [anneePrecedente, anneeCourante],
    niveaux,
    periodes,
    enseignants,
    matieres,
    classes,
    affectations,
    eleves,
    inscriptions,
    evaluations,
    notes,
    roles,
    utilisateurs,
  };
}

# Cahier de notes

Saisie, consultation et analyse des notes d'un collège. Cette branche couvre l'analyse fonctionnelle, l'architecture et la base PostgreSQL. Les écrans, l'API, l'authentification et le déploiement Vercel suivent.

- [Analyse fonctionnelle](docs/01-analyse-fonctionnelle.md)
- [Architecture](docs/02-architecture.md)

## Prérequis

- Node.js 20 ou plus
- PostgreSQL 16 local

```bash
sudo apt install postgresql
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER notes WITH PASSWORD 'notes' LOGIN;"
sudo -u postgres psql -c "CREATE DATABASE notes_scolaires OWNER notes;"
```

## Installation

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm test
npm run dev
```

`db:migrate` applique les migrations Drizzle puis les triggers (`drizzle/triggers.sql`) sur une base vide. `db:seed` remplace les données métier par le jeu de démonstration. Il refuse de tourner si `NODE_ENV=production`, sauf avec `SEED_CONFIRM=oui`.

Aucun secret réel n'est versionné. `.env` reste local.

## Comptes de démonstration

Mot de passe commun, réservé à la démo : `Demo-2026!`

| E-mail | Rôle |
| --- | --- |
| admin@tilleuls.demo | ADMIN |
| direction@tilleuls.demo | DIRECTION |
| nathan.durand@tilleuls.demo | ENSEIGNANT (physique-chimie) |
| camille.martin@tilleuls.demo | PROFESSEUR_PRINCIPAL (6e A) |
| consultation@tilleuls.demo | CONSULTATION |

Le hash bcrypt est fixe dans `src/db/demo-password.ts` pour que le seed soit déterministe.

## Jeu de données

Collège Les Tilleuls : 1 établissement, années 2024-2025 (close) et 2025-2026 (en cours), 4 classes de l'année en cours, 56 élèves, 10 enseignants, 8 matières, 6 trimestres, 224 évaluations et 3 136 notes (dont 138 absences à l'évaluation). Les profils mélangent élèves en difficulté et élèves brillants. Les moyennes se calculent dans `src/lib/grading/`.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run lint` | ESLint |
| `npm run db:generate` | Génère une migration depuis le schéma |
| `npm run db:migrate` | Applique le SQL |
| `npm run db:seed` | Charge la démo |
| `npm test` | Tests de calcul et de contraintes |

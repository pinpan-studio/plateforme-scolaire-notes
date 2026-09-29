# Déploiement

Préparation d'un déploiement Vercel + Neon. Aucune valeur secrète ne figure ici : uniquement des noms de variables et des placeholders.

## Variables

À définir dans le projet Vercel (Production et Preview séparées). Ne pas les committer.

| Nom | Rôle |
| --- | --- |
| `DATABASE_URL` | Chaîne de connexion Neon. En production, TLS exigé par Neon (`sslmode=require` est inclus dans l'URL fournie par l'intégration). La Preview doit pointer vers une base distincte de la production. |
| `AUTH_SECRET` | Secret de session Auth.js, au moins 32 caractères aléatoires. Généré côté plateforme, jamais dans le dépôt. |
| `AUTH_URL` | Origine publique HTTPS de l'application (`https://<domaine>`). Auth.js s'en sert ; l'application l'accepte aussi comme alias de `APP_URL`. |
| `APP_URL` | Origine canonique pour le cookie `Secure` et le contrôle d'origine. Même valeur que `AUTH_URL` si une seule origine est servie. |

`NEXT_PUBLIC_*` ne doit contenir ni secret, ni URL de base avec mot de passe.

## Base Neon

1. Créer une base Postgres via le marketplace Neon (ou une base déjà liée au projet).
2. Copier l'URL dans `DATABASE_URL` de l'environnement cible, sans la coller dans un ticket.
3. Répéter avec une autre base pour la Preview.

## Ordre de mise en service

`tsx` est une dépendance de production : `npm run db:migrate` s'exécute là où `node_modules` est installé (machine d'exploitation ou job), avec `DATABASE_URL` de l'environnement cible.

```bash
npm ci
npm run db:migrate
```

`db:migrate` applique `drizzle/` puis les triggers de `drizzle/triggers.sql`. Il échoue si `DATABASE_URL` est absent.

Le seed n'est pas une étape de production. Il remplace les données. En `NODE_ENV=production` il s'arrête, sauf démonstration explicite :

```bash
SEED_CONFIRM=oui npm run db:seed
```

Ordre : migrations d'abord, seed seulement sur une base de démonstration vide ou jetable.

## Santé

`GET /api/health` exécute `select 1`.

- `200` et `{ "status": "ok", "database": "ok" }` : l'application déployée joint la base.
- `503` et `{ "status": "error", "database": "indisponible" }` : la base ne répond pas.

Aucun secret n'est renvoyé.

## Vercel

`vercel.json` fixe le framework Next.js et les en-têtes de sécurité (dont HSTS). Le build est `next build`. Les pages de notes ne sont pas un cache partagé : l'application envoie `Cache-Control: private, no-store` sur les réponses métier.

Après changement de `AUTH_SECRET`, redéployer. Les sessions déjà émises deviennent invalides parce que la signature ne correspond plus, et une déconnexion incrémente `session_version` en base.

## Rotation d'un secret

1. Créer la nouvelle valeur dans les variables Vercel de l'environnement concerné.
2. Redéployer.
3. Vérifier `GET /api/health`.
4. Pour `AUTH_SECRET`, les utilisateurs se reconnectent. Pour `DATABASE_URL`, vérifier que l'hôte est bien celui de l'environnement (Preview ≠ Production).

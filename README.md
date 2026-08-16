# MULTICOM - Plateforme de visiteurs

## Vue d’ensemble

Site public (`original/index.html`), formulaire visiteurs, administration EJS sécurisée, intégration Telegram optionnelle, base PostgreSQL Neon.

## Architecture

```
GitHub → Vercel → Express (serverless) → Neon PostgreSQL
```

## Prérequis

- Node.js 20 LTS ou plus
- npm
- Projet Neon PostgreSQL
- Projet Vercel connecté au dépôt GitHub

## Installation locale

1. Cloner le dépôt.
2. `npm install`
3. Copier `.env.example` vers `.env` et renseigner les variables.
4. Exécuter le schéma SQL : `database/schema.sql` (Neon SQL Editor ou `psql`).
5. `npm start` — serveur local sur le port 3000.

## Variables d’environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `DATABASE_URL` | Oui | Chaîne PostgreSQL Neon (`sslmode=require`) |
| `SESSION_SECRET` | Oui (prod) | Secret pour cookies de session admin |
| `ADMIN_USERNAME` | Oui | Identifiant administrateur |
| `ADMIN_HASH` | Oui (prod) | Hash bcrypt du mot de passe admin |
| `NODE_ENV` | Recommandé | `production` sur Vercel |
| `TELEGRAM_BOT_TOKEN` | Optionnel | Token bot Telegram |
| `TELEGRAM_CHAT_ID` | Optionnel | Chat ID Telegram |
| `NOTIFICATIONS_ENABLED` | Optionnel | `true` / `false` |

Générer un hash admin :

```bash
node -e "require('bcryptjs').hash('VotreMotDePasse', 10).then(console.log)"
```

## Base de données

- PostgreSQL Neon uniquement via `DATABASE_URL`.
- Schéma de référence : `database/schema.sql`.
- Les tables sont aussi créées automatiquement au démarrage si absentes.

## Déploiement Vercel

1. Connecter le dépôt `business-78/MULTICOM` au projet Vercel `multicom`.
2. Ajouter les variables d’environnement dans Vercel (Settings → Environment Variables).
3. Pousser sur `main` — Vercel déploie automatiquement.
4. Vérifier :
   - `GET /` → site public
   - `POST /api/visitors` → insertion Neon
   - `/admin/login` → administration

## Sécurité

- Validation serveur des données visiteurs
- CSRF sur routes admin
- Helmet (headers + CSP)
- Rate limiting
- Cookies signés (`cookie-session`) compatibles serverless
- Aucun mot de passe par défaut — `ADMIN_HASH` requis
- Routes API sensibles protégées par authentification admin

## Structure

- `original/` — frontend public
- `app.js` — application Express (Vercel + local)
- `api/index.js` — point d’entrée Vercel serverless
- `controllers/` — logique admin/settings
- `models/` — accès Neon
- `routes/` — routes web et API
- `views/` — templates EJS admin
- `public/` — assets admin
- `database/schema.sql` — schéma PostgreSQL

## Sauvegarde (recommandation 3-2-1)

1. **Neon** — base de production (activer les backups Neon si plan payant).
2. **Export automatisé** — GitHub Action `pg_dump` vers stockage privé (non inclus, à configurer manuellement).
3. **Copie hors ligne** — export CSV périodique via `/admin/export/excel`.

Ne jamais committer de données visiteurs ou secrets dans Git.

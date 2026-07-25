# MULTICOM - Plateforme de visiteurs

## Vue d’ensemble
Ce projet fournit un site public moderne, un formulaire de visiteurs, une intégration Telegram, un tableau de bord administrateur sécurisé et une base de données prête pour un déploiement en production.

## Prérequis
- Node.js 20 LTS ou plus
- npm
- Une base de données MySQL ou PostgreSQL
- Un bot Telegram (optionnel)

## Installation locale
1. Cloner ou copier ce dossier.
2. Installer les dépendances :
   `npm install`
3. Copier le fichier `.env.example` vers `.env` puis renseigner les variables.
4. Démarrer le serveur :
   `npm start`

## Variables d’environnement
Les variables suivantes doivent être présentes dans `.env` :
- `PORT`
- `NODE_ENV`
- `DATABASE_URL` (pour Supabase/PostgreSQL)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (pour MySQL)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SESSION_SECRET`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_USERNAME`

## Base de données
- Le projet crée automatiquement les tables nécessaires au démarrage.
- Pour Supabase PostgreSQL, utilisez `DATABASE_URL`.
- Le script SQL de référence est disponible dans `database/supabase.sql`.

## Configuration Telegram
1. Créer un bot avec BotFather.
2. Récupérer le token et le chat ID.
3. Les renseigner dans `.env`.

## Déploiement sur Render
1. Créer un nouveau service Web sur Render.
2. Connecter le dépôt GitHub.
3. Sélectionner `Node`.
4. Définir le build command : `npm install`
5. Définir le start command : `npm start`
6. Ajouter les variables d’environnement depuis `.env`.

## Déploiement avec Supabase
1. Créer une base PostgreSQL sur Supabase.
2. Ouvrir l’éditeur SQL.
3. Exécuter le contenu de `database/supabase.sql`.
4. Copier la chaîne de connexion dans `DATABASE_URL`.

## Sécurité
Le projet intègre :
- validation serveur des données
- protection CSRF
- protection XSS via échappement et en-têtes Helmet
- limitation des tentatives de connexion
- sessions sécurisées
- mot de passe administrateur à configurer dans `.env`

## Structure du projet
- `controllers/`
- `routes/`
- `models/`
- `middleware/`
- `config/`
- `public/`
- `views/`
- `database/`
- `logs/`

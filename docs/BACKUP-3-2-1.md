# Stratégie de sauvegarde 3-2-1 — MULTICOM

Ce document décrit la stratégie de sauvegarde des données PostgreSQL hébergées sur **Neon** pour le projet MULTICOM.

Les données critiques sont :

- `visitors`
- `settings`

Cette stratégie est **indépendante** de l'application (pas de fallback JSON, pas d'écriture filesystem applicative).

---

## A. Architecture 3-2-1 retenue

| Copie | Rôle | Support / système | Hors site |
|-------|------|-------------------|-----------|
| **#1** | Production | Neon PostgreSQL | Oui (cloud Neon) |
| **#2** | Backup automatisé | GitHub Actions + `pg_dump` → artifacts privés | Oui (GitHub, distinct de Neon) |
| **#3** | Copie hors ligne administrateur | Fichier local chiffré / disque externe | Oui (physique ou cloud perso) |

**Optionnel (copie #3 renforcée)** : stockage S3-compatible (Backblaze B2, Cloudflare R2, AWS S3) via secrets GitHub.

---

## B. Copie #1 — Neon (production)

- Base active utilisée par Vercel.
- Tables : `visitors`, `settings`.
- Schéma de référence : `database/schema.sql`.

### Fonctionnalités natives Neon

| Fonctionnalité | Plan Free | Plans payants |
|----------------|-----------|---------------|
| Branches / restore ponctuel | Limité | Étendu |
| PITR (Point-in-Time Recovery) | Non / très limité | Oui (selon plan) |
| Historique long | Court (~24h selon offre) | Configurable |

**Important :** ne pas supposer que PITR ou backups longue durée sont gratuits. Vérifier le plan Neon actuel dans la console Neon → **Settings / Billing**.

La copie #1 reste la source de vérité en production, mais **ne suffit pas seule** pour une stratégie 3-2-1.

---

## C. Copie #2 — Backup automatisé GitHub Actions

Workflow : `.github/workflows/database-backup.yml`

### Fonctionnement

1. Déclenchement planifié ou manuel (`workflow_dispatch`)
2. Installation du client PostgreSQL
3. `pg_dump` via secret `NEON_DATABASE_URL`
4. Production de :
   - `backup_multicom_<label>_<timestamp>.sql.gz` (restauration via `psql`)
   - `backup_multicom_<label>_<timestamp>.dump` (restauration via `pg_restore`)
5. Vérification que les tables `visitors` et `settings` sont présentes
6. Upload vers **GitHub Actions Artifacts** (privés au dépôt)

### Fréquence

| Type | Cron UTC | Rétention artifact |
|------|----------|-------------------|
| Quotidien | 03:15 tous les jours | 7 jours |
| Hebdomadaire | 04:00 dimanche | 28 jours |
| Mensuel | 05:00 le 1er du mois | 180 jours |
| Manuel | `workflow_dispatch` | 7 jours |

### Coût

- **GitHub Actions** : gratuit pour dépôts publics / quota mensuel sur privés.
- **Artifacts** : inclus dans le quota GitHub ; pas de coût additionnel tant que les quotas ne sont pas dépassés.

---

## D. Copie #3 — Hors site administrateur

### Option A — Téléchargement depuis GitHub Actions (recommandé)

1. GitHub → **Actions** → workflow **Database Backup**
2. Ouvrir la dernière exécution réussie
3. Télécharger l'artifact `multicom-db-...`
4. Renommer / archiver : `backup_multicom_YYYY-MM-DD.sql.gz`
5. Stocker sur :
   - disque externe chiffré
   - NAS personnel
   - cloud personnel distinct (Google Drive chiffré, OneDrive, etc.)

### Option B — Script local

```powershell
# Windows
$env:NEON_DATABASE_URL = '<votre URL Neon directe>'
.\scripts\backup_database.ps1
```

```bash
# Linux / macOS / WSL
export NEON_DATABASE_URL='<votre URL Neon directe>'
./scripts/backup_database.sh
```

Fichier généré : `backups/local/backup_multicom_YYYY-MM-DD_HHMMSS.sql.gz`

### Option C — Stockage S3-compatible (optionnel)

Configurer les secrets GitHub listés ci-dessous. Le workflow uploadera automatiquement les backups.

**Services possibles (coût indicatif) :**

| Service | Gratuit / faible coût | Notes |
|---------|----------------------|-------|
| Cloudflare R2 | 10 Go stockage gratuits / mois | Bon rapport qualité/prix |
| Backblaze B2 | ~10 Go gratuits | Compatible S3 |
| AWS S3 | Payant après free tier | Standard industrie |

---

## E. Stockage choisi par défaut

- **Automatique :** GitHub Actions Artifacts (privé)
- **Manuel :** dossier local administrateur hors dépôt Git
- **Optionnel :** bucket S3-compatible privé

Les backups ne doivent **jamais** être placés dans :

- `public/`
- `original/`
- `database/` du dépôt
- un dossier servi par Express/Vercel

---

## F. Coût estimé

| Composant | Coût |
|-----------|------|
| Neon (copie #1) | Selon plan Neon actuel |
| GitHub Actions + artifacts | Généralement 0 € si quotas respectés |
| Copie locale admin | 0 € (disque existant) |
| S3/B2/R2 optionnel | 0 € à quelques €/mois selon volume |

---

## G. Fréquence

- **Quotidien** : backup automatisé
- **Hebdomadaire** : backup automatisé longue rétention
- **Mensuel** : backup automatisé archive
- **Manuel** : recommandé après opérations sensibles (migration, gros import)

---

## H. Rétention

| Niveau | Durée | Emplacement |
|--------|-------|-------------|
| Quotidien | 7 jours | GitHub artifact |
| Hebdomadaire | 4 semaines | GitHub artifact |
| Mensuel | 6 mois | GitHub artifact |
| Hors ligne admin | Selon politique interne | Disque / cloud perso |

---

## I. Fichiers créés

| Fichier | Rôle |
|---------|------|
| `.github/workflows/database-backup.yml` | Automatisation GitHub Actions |
| `scripts/backup_database.sh` | Backup local Linux/macOS |
| `scripts/backup_database.ps1` | Backup local Windows |
| `scripts/restore_database.sh` | Restauration vers base de test |
| `scripts/restore_database.ps1` | Restauration vers base de test |
| `docs/BACKUP-3-2-1.md` | Ce document |

---

## J. Secrets GitHub nécessaires (noms uniquement)

### Obligatoire

| Secret | Description |
|--------|-------------|
| `NEON_DATABASE_URL` | URL PostgreSQL Neon **directe** (recommandé pour `pg_dump`, SSL requis) |

### Optionnels (stockage S3-compatible)

| Secret | Description |
|--------|-------------|
| `BACKUP_S3_BUCKET` | Nom du bucket privé |
| `BACKUP_S3_ACCESS_KEY_ID` | Clé d'accès |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Clé secrète |
| `BACKUP_S3_REGION` | Région (ex. `auto` pour R2) |
| `BACKUP_S3_ENDPOINT` | Endpoint S3-compatible (ex. R2/B2) |

**Ne jamais committer :** `DATABASE_URL`, tokens, mots de passe, dumps SQL.

### Configuration

1. GitHub → dépôt `business-78/MULTICOM`
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** → `NEON_DATABASE_URL`
4. Utiliser l'endpoint **direct** Neon (pas le pooler) pour `pg_dump`

---

## K. Procédure de restauration (base de TEST uniquement)

**NE JAMAIS restaurer directement sur la production sans validation.**

### 1. Créer une base de test

- Nouveau projet Neon de test, ou branche Neon dédiée

### 2. Restaurer depuis un fichier `.sql.gz`

```bash
export TARGET_DATABASE_URL='postgresql://...base-de-test...?sslmode=require'
./scripts/restore_database.sh backups/local/backup_multicom_2026-08-16.sql.gz
```

Windows :

```powershell
$env:TARGET_DATABASE_URL = 'postgresql://...base-de-test...?sslmode=require'
.\scripts\restore_database.ps1 -BackupFile .\backups\local\backup_multicom_2026-08-16.sql.gz
```

### 3. Vérifier

```sql
SELECT COUNT(*) FROM visitors;
SELECT COUNT(*) FROM settings;
SELECT * FROM visitors ORDER BY created_at DESC LIMIT 10;
```

### 4. Restauration depuis artifact GitHub

1. Télécharger l'artifact
2. Extraire le `.sql.gz`
3. Suivre l'étape 2 ci-dessus

### 5. Restauration depuis dump custom (`.dump`)

```bash
pg_restore --no-owner --no-acl --dbname="$TARGET_DATABASE_URL" backup_multicom_daily_YYYY-MM-DD.dump
```

---

## L. Test de restauration recommandé

| Étape | Action |
|-------|--------|
| 1 | Lancer le workflow **Database Backup** manuellement |
| 2 | Télécharger l'artifact |
| 3 | Créer une base Neon de test |
| 4 | Restaurer le `.sql.gz` |
| 5 | Vérifier `visitors` et `settings` |
| 6 | Documenter la date du test |

Fréquence recommandée : **trimestrielle**.

---

## M. Risques restants

| Risque | Mitigation |
|--------|------------|
| Secret `NEON_DATABASE_URL` mal configuré | Utiliser endpoint direct ; tester le workflow manuellement |
| Artifact GitHub supprimé après rétention | Copie hors ligne admin mensuelle |
| Backup contient des PII | Chiffrer les copies locales ; restreindre l'accès |
| Restauration sur production par erreur | Toujours utiliser `TARGET_DATABASE_URL` de test |
| Plan Neon Free sans PITR long | S'appuyer sur copies #2 et #3 |

---

## N. Actions manuelles nécessaires

1. [ ] Ajouter le secret GitHub `NEON_DATABASE_URL` (endpoint direct Neon)
2. [ ] Pousser ce commit sur `main` pour activer le workflow
3. [ ] Lancer manuellement **Database Backup** une première fois
4. [ ] Télécharger un artifact et le conserver hors ligne
5. [ ] (Optionnel) Configurer les secrets S3 pour copie #3 cloud
6. [ ] Effectuer un test de restauration sur base Neon de test
7. [ ] Vérifier le plan Neon et activer PITR si besoin métier (plan payant)

---

## Sécurité

- Les backups contiennent des données personnelles (email, téléphone, messages).
- Ne pas publier les dumps.
- Ne pas les versionner dans Git.
- Limiter l'accès aux artifacts GitHub aux administrateurs du dépôt.
- Chiffrer les copies locales si possible (BitLocker, VeraCrypt, coffre cloud chiffré).

---

## Export CSV admin (complément, pas backup 3-2-1)

La route `/admin/export/excel` permet un export CSV des visiteurs pour consultation ponctuelle.

Ce n'est **pas** un substitut à `pg_dump` : pas de schéma complet, pas de `settings` garanti, pas de restauration PostgreSQL native.

# 🐳 Docker Deployment Guide

Ce guide explique comment déployer le bot Discord nword-counter avec Docker et PostgreSQL.

## 📋 Prérequis

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## 🚀 Démarrage rapide

### 1. Configuration de l'environnement

```bash
# Copier le fichier d'environnement Docker
cp .env.docker .env

# Éditer le fichier .env avec vos valeurs
# DISCORD_BOT_TOKEN=your_actual_bot_token
# DB_PASSWORD=your_secure_password
```

### 2. Lancement de l'application

```bash
# Construire et démarrer tous les services
pnpm run docker:up

# Ou utiliser Docker Compose directement
docker-compose up -d
```

### 3. Vérification

```bash
# Voir les logs du bot
pnpm run docker:logs

# Vérifier le statut des services
docker-compose ps
```

## 🗂️ Services inclus

### 🤖 Bot Discord (`bot`)
- **Port**: Aucun (service interne)
- **Volumes**: 
  - `./models:/app/models` (modèles Vosk)
  - `./logs:/app/logs` (logs optionnels)

### 🗄️ PostgreSQL (`postgres`)
- **Port**: `5432`
- **Base**: `nword_counter`
- **Volume**: `postgres_data` (persistant)


## 📜 Scripts disponibles

| Script | Description |
|--------|-------------|
| `pnpm run docker:build` | Construire l'image Docker |
| `pnpm run docker:up` | Démarrer en arrière-plan |
| `pnpm run docker:dev` | Démarrer avec logs visibles |
| `pnpm run docker:down` | Arrêter les services |
| `pnpm run docker:logs` | Voir les logs du bot |
| `pnpm run docker:restart` | Redémarrer le bot |
| `pnpm run docker:clean` | Nettoyer complètement |

## 🔧 Configuration avancée

### Variables d'environnement

```env
# Discord (OBLIGATOIRE)
DISCORD_BOT_TOKEN=your_bot_token

# Base de données (OBLIGATOIRE)
DB_PASSWORD=secure_password


# Production
NODE_ENV=production
```

### Volumes persistants

- **`postgres_data`**: Données de la base PostgreSQL
- **`./models`**: Modèles de reconnaissance vocale
- **`./logs`**: Logs de l'application (optionnel)

## 🌐 Accès aux services

- **Bot Discord**: Aucun port (service interne)
- **PostgreSQL**: `localhost:5432`

## 🔍 Monitoring et logs

```bash
# Logs en temps réel
docker-compose logs -f

# Logs d'un service spécifique
docker-compose logs -f bot
docker-compose logs -f postgres

# Vérifier l'état des services
docker-compose ps

# Statistiques d'utilisation
docker stats
```

## 🛠️ Débogage

### Problèmes courants

**Bot ne se connecte pas:**
```bash
# Vérifier les logs
pnpm run docker:logs

# Vérifier la configuration
cat .env
```

**Base de données inaccessible:**
```bash
# Vérifier PostgreSQL
docker-compose exec postgres pg_isready -U postgres

# Se connecter à la base
docker-compose exec postgres psql -U postgres -d nword_counter
```

**Redémarrer un service:**
```bash
# Redémarrer le bot uniquement
docker-compose restart bot

# Redémarrer PostgreSQL
docker-compose restart postgres
```

## 🔄 Mise à jour

```bash
# Arrêter les services
pnpm run docker:down

# Reconstruire l'image
pnpm run docker:build

# Redémarrer
pnpm run docker:up
```

## 🧹 Nettoyage

```bash
# Arrêter et supprimer les conteneurs
pnpm run docker:down

# Nettoyage complet (⚠️ supprime les données)
pnpm run docker:clean

# Supprimer seulement les conteneurs (garde les données)
docker-compose down
```

## 🔒 Sécurité

- Utilisez des mots de passe forts
- Ne commitez jamais le fichier `.env`
- Limitez l'accès aux ports exposés
- Activez SSL en production (`DB_SSL=true`)

## 📊 Monitoring de production

Pour un environnement de production, considérez:

1. **Monitoring**: Prometheus + Grafana
2. **Logs centralisés**: ELK Stack
3. **Reverse proxy**: Nginx
4. **SSL/TLS**: Let's Encrypt
5. **Backup**: Scripts de sauvegarde PostgreSQL

```bash
# Exemple de backup
docker-compose exec postgres pg_dump -U postgres nword_counter > backup.sql
```
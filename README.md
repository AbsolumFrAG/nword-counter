# Discord Voice Detection Bot

Un bot Discord qui utilise la reconnaissance vocale pour détecter et compter certains mots interdits prononcés dans les salons vocaux, avec base de données PostgreSQL pour le stockage persistant.

## Fonctionnalités

- **Reconnaissance vocale en temps réel** : Utilise Vosk pour la transcription audio hors ligne
- **Base de données PostgreSQL** : Stockage persistant des classements
- **Déploiement Docker** : Environnement conteneurisé complet
- **Commandes slash** :
  - `/connect` : Connecte le bot à votre salon vocal
  - `/disconnect` : Déconnecte le bot du salon vocal
  - `/leaderboard` : Affiche le classement des utilisateurs avec dates
  - `/stats` : Statistiques du serveur
  - `/reset` : Réinitialisation (utilisateur ou serveur entier pour les admins)

## Installation

### 🐳 Installation avec Docker (Recommandée)

1. **Cloner le repository** :
```bash
git clone <repository-url>
cd nword-counter
```

2. **Configuration** :
```bash
cp .env.docker .env
# Éditer .env avec votre token Discord et mot de passe DB
```

3. **Lancement** :
```bash
pnpm run docker:up
```

Voir [README.Docker.md](README.Docker.md) pour plus de détails.

### 🔧 Installation manuelle

1. **Prérequis** :
- Node.js 22+
- PostgreSQL 17+
- pnpm

2. **Installation** :
```bash
pnpm run setup
```

3. **Configuration** :
```bash
cp .env.example .env
# Configurer .env avec votre token Discord et paramètres DB
```

4. **Base de données** :
- Créer une base PostgreSQL nommée `nword_counter`
- Les tables seront créées automatiquement

5. **Démarrage** :
```bash
pnpm start
```

## Configuration du bot Discord

- Créez un bot sur [Discord Developer Portal](https://discord.com/developers/applications)
- Copiez le token dans votre fichier `.env`
- Invitez le bot avec les permissions : `View Channels`, `Connect`, `Speak`, `Use Voice Activity`, `Use Slash Commands`

## Utilisation

1. **Dans Discord** :
- Rejoignez un salon vocal
- Utilisez `/connect` pour connecter le bot
- Parlez dans le salon vocal - le bot transcrira automatiquement
- Utilisez `/leaderboard` pour voir le classement
- Utilisez `/stats` pour les statistiques du serveur
- Utilisez `/disconnect` pour déconnecter le bot

## Scripts disponibles

### Scripts de développement
- `pnpm run build` : Compile le TypeScript
- `pnpm run start` : Démarre le bot
- `pnpm run dev` : Compile et démarre le bot
- `pnpm run setup` : Installation complète

### Scripts Docker
- `pnpm run docker:up` : Démarrer avec Docker
- `pnpm run docker:down` : Arrêter les services
- `pnpm run docker:logs` : Voir les logs
- `pnpm run docker:restart` : Redémarrer le bot
- `pnpm run docker:clean` : Nettoyage complet

## Technologies utilisées

- **TypeScript** : Langage principal
- **discord.js** : API Discord  
- **@discordjs/voice** : Support audio Discord
- **PostgreSQL** : Base de données relationnelle
- **Vosk** : Reconnaissance vocale hors ligne (français)
- **Docker** : Conteneurisation
- **Winston** : Logging structuré
- **Zod** : Validation des schemas
- **prism-media** : Traitement audio

## Architecture

### 🏗️ **Architecture modulaire**
```
src/
├── app.ts                 # Point d'entrée principal
├── bot/
│   └── client.ts          # Client Discord orchestré
├── commands/              # Commandes slash modulaires
│   ├── baseCommand.ts     # Classe de base avec rate limiting
│   ├── connectCommand.ts  
│   ├── disconnectCommand.ts
│   ├── leaderboardCommand.ts
│   ├── statsCommand.ts
│   ├── resetCommand.ts
│   └── index.ts
├── services/              # Services métier
│   ├── audioService.ts    # Pipeline audio optimisé
│   ├── databaseService.ts # Service PostgreSQL avec logging
│   ├── speechService.ts   # Service reconnaissance vocale
│   └── index.ts
├── config/
│   └── environment.ts     # Validation configuration Zod
└── utils/
    ├── logger.ts          # Logging Winston structuré
    ├── rateLimiter.ts     # Rate limiting intelligent
    └── healthCheck.ts     # Monitoring et santé
```

### 🔧 **Fonctionnalités avancées**
- **Logging structuré** : Winston avec rotation et niveaux
- **Rate limiting** : Protection anti-spam par utilisateur
- **Validation environnement** : Schema Zod strict  
- **Health checks** : Monitoring base de données et services
- **Architecture modulaire** : Services découplés et testables
- **Gestion d'erreurs** : Comprehensive error handling avec logging

## Avertissement

Ce bot est fourni à des fins éducatives. Assurez-vous de respecter les règles de votre serveur Discord et les conditions d'utilisation de Discord.
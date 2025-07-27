# Discord Voice Detection Bot

Un bot Discord qui utilise la reconnaissance vocale pour détecter et compter certains mots interdits prononcés dans les salons vocaux.

## Fonctionnalités

- **Reconnaissance vocale en temps réel** : Utilise Vosk pour la transcription audio hors ligne
- **Commandes slash** :
  - `/connect` : Connecte le bot à votre salon vocal
  - `/disconnect` : Déconnecte le bot du salon vocal
  - `/leaderboard` : Affiche le classement des utilisateurs

## Installation

1. **Cloner le repository** :
```bash
git clone <repository-url>
cd nword-counter
```

2. **Installer les dépendances et configurer** :
```bash
pnpm run setup
```
Cette commande va :
- Installer les dépendances Node.js
- Télécharger le modèle Vosk pour la reconnaissance vocale (40 MB)
- Compiler le code TypeScript

3. **Configurer le bot Discord** :
- Créez un bot sur [Discord Developer Portal](https://discord.com/developers/applications)
- Copiez le token du bot
- Créez un fichier `.env` basé sur `.env.example` :
```env
DISCORD_BOT_TOKEN=votre_token_ici
```

4. **Inviter le bot sur votre serveur** :
- Dans le Discord Developer Portal, allez dans OAuth2 > URL Generator
- Sélectionnez les scopes : `bot`, `applications.commands`
- Sélectionnez les permissions : `View Channels`, `Connect`, `Speak`, `Use Voice Activity`
- Utilisez l'URL générée pour inviter le bot

## Utilisation

1. **Démarrer le bot** :
```bash
pnpm start
```

2. **Dans Discord** :
- Rejoignez un salon vocal
- Utilisez `/connect` pour connecter le bot
- Parlez dans le salon vocal - le bot transcrira automatiquement
- Utilisez `/leaderboard` pour voir les statistiques
- Utilisez `/disconnect` pour déconnecter le bot

## Scripts disponibles

- `pnpm run build` : Compile le TypeScript
- `pnpm run start` : Démarre le bot
- `pnpm run dev` : Compile et démarre le bot
- `pnpm run download-model` : Télécharge le modèle Vosk
- `pnpm run setup` : Installation complète

## Technologies utilisées

- **TypeScript** : Langage principal
- **discord.js** : API Discord
- **@discordjs/voice** : Support audio Discord
- **Vosk** : Reconnaissance vocale hors ligne
- **prism-media** : Traitement audio

## Notes

- La reconnaissance vocale fonctionne hors ligne grâce à Vosk
- Le modèle utilisé est `vosk-model-small-en-us-0.15` (anglais américain)
- Les données sont stockées en mémoire et sont perdues au redémarrage du bot
- Pour une utilisation en production, considérez l'ajout d'une base de données

## Avertissement

Ce bot est fourni à des fins éducatives. Assurez-vous de respecter les règles de votre serveur Discord et les conditions d'utilisation de Discord.
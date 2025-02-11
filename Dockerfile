# Dockerfile pour le bot Discord
FROM node:22-slim

WORKDIR /app

# Installation des dépendances nécessaires pour node-opus et pnpm
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Installation de pnpm
RUN npm install -g pnpm

# Copie des fichiers de dépendances
COPY package*.json pnpm-lock.yaml ./

# Installation des dépendances avec pnpm
RUN pnpm install

# Copie du reste du code source
COPY . .

# Création des dossiers nécessaires
RUN mkdir -p data temp

# Commande de démarrage
CMD ["pnpm", "start"]
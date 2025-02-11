# Dockerfile pour le bot Discord
FROM node:22-slim

WORKDIR /app

# Installation des dépendances nécessaires pour node-opus et pnpm
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    libsqlite3-dev \
    build-essential \
    libtool \
    autoconf \
    automake \
    libopus-dev \
    opus-tools \
    && rm -rf /var/lib/apt/lists/*

# Installation de pnpm
RUN npm install -g pnpm@latest

# Configuration de pnpm pour les builds
RUN pnpm config set enable-pre-post-scripts true \
    && pnpm config set unsafe-perm true

# Copie des fichiers de dépendances
COPY package*.json ./

# Configuration de l'environnement pour la compilation
ENV npm_config_build_from_source=true
ENV npm_config_sqlite=/usr
ENV CFLAGS="-O2"
ENV CXXFLAGS="-O2"

# Installation des dépendances
RUN pnpm install --no-frozen-lockfile \
    && pnpm install sqlite3 --no-frozen-lockfile \
    && pnpm rebuild

# Copie du reste du code source
COPY . .

# Création des dossiers nécessaires
RUN mkdir -p data temp

# Commande de démarrage
CMD ["pnpm", "start"]
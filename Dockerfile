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

# Installation de pnpm et node-gyp
RUN npm install -g pnpm node-gyp

# Configuration de node-gyp
ENV npm_config_node_gyp=/usr/local/lib/node_modules/node-gyp/bin/node-gyp.js

# Copie des fichiers de dépendances
COPY package*.json ./

# Variables d'environnement pour la compilation
ENV CFLAGS="-O2"
ENV CXXFLAGS="-O2"
ENV npm_config_build_from_source=true
ENV npm_config_sqlite=/usr
ENV JOBS=max

# Configuration de pnpm pour autoriser les builds
RUN pnpm config set enable-pre-post-scripts true
RUN pnpm config set unsafe-perm true

# Installation des dépendances avec pnpm
RUN pnpm install \
    && pnpm rebuild @discordjs/opus \
    && pnpm rebuild sqlite3

# Copie du reste du code source
COPY . .

# Création des dossiers nécessaires
RUN mkdir -p data temp

# Commande de démarrage
CMD ["pnpm", "start"]
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

# Configuration de pnpm
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

# Installation de pnpm
RUN npm install -g pnpm@latest \
    && pnpm setup \
    && npm install -g node-gyp

# Configuration de l'environnement pour la compilation
ENV npm_config_build_from_source=true
ENV npm_config_sqlite=/usr
ENV CFLAGS="-O2"
ENV CXXFLAGS="-O2"

# Copie des fichiers de dépendances
COPY package*.json ./

# Configure pnpm
RUN pnpm config set enable-pre-post-scripts true && \
    pnpm config set unsafe-perm true

# Installation et compilation des dépendances
RUN pnpm install --ignore-scripts && \
    cd node_modules/sqlite3 && \
    node-gyp clean configure build && \
    cd ../.. && \
    cd node_modules/@discordjs/opus && \
    node-gyp clean configure build && \
    cd ../..

# Copie du reste du code source
COPY . .

# Création des dossiers nécessaires
RUN mkdir -p data temp

# Commande de démarrage
CMD ["pnpm", "start"]
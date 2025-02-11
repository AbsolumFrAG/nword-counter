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
    && rm -rf /var/lib/apt/lists/*

# Installation de pnpm
RUN npm install -g pnpm

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances avec pnpm, en forçant la compilation de sqlite3
ENV CFLAGS="-O2"
ENV CXXFLAGS="-O2"
ENV npm_config_build_from_source=true

# Installation sans --frozen-lockfile pour permettre la mise à jour du lockfile
RUN pnpm install

# Copie du reste du code source
COPY . .

# Création des dossiers nécessaires
RUN mkdir -p data temp

# Commande de démarrage
CMD ["pnpm", "start"]
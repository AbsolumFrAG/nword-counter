FROM node:22-slim

WORKDIR /app

# Installation des dépendances nécessaires pour node-opus et pnpm
RUN apt-get update && apt-get install -y \
    python3 \
    pkg-config \
    make \
    g++ \
    libtool \
    automake \
    autoconf \
    gcc \
    libopus-dev \
    ffmpeg \
    opus-tools \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

WORKDIR /app

# Copie des fichiers de dépendances
COPY package.json pnpm-lock.yaml ./

# Installation des dépendances
RUN pnpm install

# Copie du reste du code source
COPY . .

# Démarrage de l'application
CMD ["pnpm", "start"]
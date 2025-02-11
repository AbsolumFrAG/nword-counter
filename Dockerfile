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
    software-properties-common \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Installation de FFmpeg depuis le PPA pour avoir toutes les fonctionnalités
RUN apt-get update && apt-get install -y \
    wget \
    && wget -O - https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | tar xJf - -C /usr/local/bin --strip-components=1 --wildcards '*/ffmpeg' '*/ffprobe' \
    && chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe \
    && apt-get remove -y wget \
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
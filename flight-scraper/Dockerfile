FROM node:20-slim

# Chromium system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libdbus-1-3 libxkbcommon0 libatspi2.0-0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libx11-xcb1 libfontconfig1 libx11-6 \
    libxcb1 libxext6 libxshmfence1 libglib2.0-0 libxss1 libxtst6 \
    fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV CLOAKBROWSER_CACHE_DIR=/app/.cloakbrowser

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

# Pre-download stealth Chromium binary at build time
RUN node -e "import('cloakbrowser').then(m => m.ensureBinary())"

COPY src/ ./src/

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]

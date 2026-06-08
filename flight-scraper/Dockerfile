FROM node:20-slim

WORKDIR /app

ENV CLOAKBROWSER_CACHE_DIR=/app/.cloakbrowser

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY src/ ./src/

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]

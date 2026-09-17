FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
# Persist data by mounting a volume at /app/data, or mount elsewhere and set
# DATA_DIR to that path (required on Railway — Dockerfile VOLUME is not allowed).
# CMD is overridden by railway.json's startCommand on Railway.
CMD ["node", "src/index.js"]

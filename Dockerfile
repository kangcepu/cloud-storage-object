FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install --yes --no-install-recommends imagemagick \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    PORT=6000 \
    STORAGE_PATH=/var/lib/cloud-storage \
    IMAGE_MAGICK_BIN=convert

COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN mkdir -p /var/lib/cloud-storage \
  && chown -R node:node /app /var/lib/cloud-storage

USER node
EXPOSE 6000

CMD ["node", "dist/main.js"]

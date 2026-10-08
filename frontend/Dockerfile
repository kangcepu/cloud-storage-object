FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
ARG BACKEND_URL=http://api:6000
ENV BACKEND_URL=$BACKEND_URL
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=6001 \
    BACKEND_URL=http://api:6000

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.ts ./

RUN chown -R node:node /app

USER node
EXPOSE 6001

CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "6001"]

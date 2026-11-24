# ---------- build stage ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# prisma generate does not connect to the DB; a placeholder URL satisfies prisma.config.ts.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
 && npm run build

# ---------- runtime stage ----------
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
 && chown node:node /app

# Everything below runs as the unprivileged "node" user and is owned by it, so
# `npm run db:setup` (which re-runs prisma generate) can write node_modules.
USER node

COPY --chown=node:node package.json package-lock.json ./
# prisma (CLI) is a runtime dependency, so `npm run db:setup` works inside the container.
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prisma.config.ts ./
COPY --chown=node:node seed-admin.js seed.js seed-settings.js ./
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate
COPY --from=build --chown=node:node /app/dist ./dist

# Uploaded task files live here; mount a volume on it.
RUN mkdir -p /app/uploads

EXPOSE 4000
CMD ["node", "dist/main"]

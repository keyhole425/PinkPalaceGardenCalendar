# figgy, as one container.
#
# Multi-stage so the image carries the built app and its runtime dependencies
# rather than the toolchain. better-sqlite3 needs its native binding, so the
# builder installs the full dependency tree and the runner copies what Next's
# standalone output actually references.

FROM node:26-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Build tools for better-sqlite3 in case no prebuild matches this platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && npm ci \
  && apt-get purge -y python3 make g++ && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

FROM node:26-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:26-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# The database lives on a volume, not in the image.
ENV GARDEN_DB_PATH=/data/garden.db
ENV GARDEN_BACKUP_PATH=/backups

RUN groupadd --system --gid 1001 figgy \
  && useradd --system --uid 1001 --gid figgy figgy

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Migrations, seed and backups run inside the container, and they are
# TypeScript that imports through the "@/*" alias - which only tsx resolves.
# That is why the full dependency tree comes across rather than just the
# modules Next traced for server.js.
COPY --from=builder /app/db ./db
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/ops/entrypoint.sh ./entrypoint.sh

RUN mkdir -p /data /backups && chown -R figgy:figgy /data /backups /app
USER figgy

EXPOSE 3000
# 0.0.0.0, or nothing on the network can reach it.
ENV HOSTNAME=0.0.0.0
CMD ["./entrypoint.sh"]

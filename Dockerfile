# syntax=docker/dockerfile:1
# ISSATKr production image. Two runtime targets:
#   runner : the web application (Next.js standalone server), non-root
#   tools  : one-shot jobs (prisma migrate deploy, first admin, backups), non-root
# No secrets are baked in: configuration comes from the env file at run time.

ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base
# openssl: Prisma query engine; ca-certificates: SMTP over TLS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# No telemetry or update checks from Next.js / Prisma (no outbound calls at run time).
ENV NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

# ---- dependencies (full install: the build and the Prisma CLI need dev deps)
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---- build
FROM deps AS builder
COPY . .
RUN npm run build

# ---- tools: migrations, admin bootstrap, backup / verification
FROM base AS tools
ENV NODE_ENV=production
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node scripts/*.mjs ./scripts/
RUN mkdir -p /data/uploads /data/backups && chown -R node:node /data
USER node
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

# ---- web application
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN mkdir -p /data/uploads /data/backups && chown -R node:node /data
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]

# ============================================================================
# Analytics — Multi-stage Dockerfile (Node 20 Alpine + standalone Next.js)
# ============================================================================

# ----------------------------------------------------------------------------
# STAGE 1: Dependencies
# ----------------------------------------------------------------------------
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files + Prisma schema (postinstall → prisma generate)
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
# pnpm 10+ refuse les build scripts non-allowlistes (ERR_PNPM_IGNORED_BUILDS).
# On install sans scripts, puis on rebuild explicitement les deps natives.
RUN pnpm install --frozen-lockfile --ignore-scripts \
    && pnpm rebuild @prisma/client prisma esbuild sharp

# ----------------------------------------------------------------------------
# STAGE 2: Builder
# ----------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# ----------------------------------------------------------------------------
# STAGE 3: Runner (production)
# ----------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Applique les correctifs de securite Alpine publies APRES le dernier rebuild de
# l'image officielle node:22-alpine. Sans cette ligne, l'image finale reste
# vulnerable tant que Docker Official Images n'a pas republie sa base, ce qui
# prend des jours : CVE-2026-14456 (openssl/libcrypto3/libssl3 3.5.7-r0, corrige
# en 3.5.8-r0) a bloque le gate Trivy pendant 7 jours pour cette seule raison.
# Le correctif etait publie dans le depot Alpine 3.24, juste pas dans l'image.
RUN apk upgrade --no-cache

# The standalone server only needs the Node runtime. Removing package managers
# also removes their unused transitive CVE surface from the production image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack && \
    rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
# Next.js standalone bundles everything needed (including Prisma client via
# the pnpm symlinks). No need to copy .prisma or @prisma separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Public assets (tracker.js, favicons, etc.) — le standalone output ne les
# inclut pas automatiquement, on les copie explicitement.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]

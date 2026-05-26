FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10.6.5 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
RUN echo "node-linker=hoisted" > .npmrc && \
    pnpm install --frozen-lockfile --filter @roots/web...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PLAUSIBLE_DOMAIN=$NEXT_PUBLIC_PLAUSIBLE_DOMAIN

# P2.38 (audit 2026-05-26): tidigare satte vi SKIP_TYPECHECK=true här
# permanent vilket bypass:ade Next's TS-gate även i produktion. Det är
# nu borta — kontexten kopieras med `COPY . .` ovan så cross-package
# typer finns tillgängliga. Akut hotfix kan opta out med
# `--build-arg ROOTS_FORCE_SKIP_TYPECHECK=true`.
ARG ROOTS_FORCE_SKIP_TYPECHECK
ENV ROOTS_FORCE_SKIP_TYPECHECK=$ROOTS_FORCE_SKIP_TYPECHECK

RUN cd apps/web && npx next build

FROM base AS runtime
WORKDIR /app

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs
USER nodejs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Scout fix 2026-05-26 (FE-OPS-01): tidigare probade vi GET / vilket
# (via preview-gate-middleware) kan returnera 503 om SITE_PREVIEW_PASSWORD
# saknas i miljön → container-restart-loop. /healthz bypassas av
# middleware och svarar alltid 200 = pålitlig liveness-probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>{if(!r.ok)throw 1})" || exit 1
CMD ["node", "apps/web/server.js"]

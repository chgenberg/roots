FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10.6.5 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
RUN echo "node-linker=hoisted" > .npmrc && \
    pnpm install --frozen-lockfile --filter @roots/api...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN cd apps/api && npx tsup

FROM base AS runtime
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
# Migrations folder must ship in the runtime image so RUN_MIGRATIONS_ON_BOOT
# can find SQL files at startup. Master CSVs ship too for ad-hoc seed runs
# (`node -e "require('@roots/db').seedMasters()"` from a one-off task).
COPY --from=build /app/packages/db/drizzle ./drizzle
COPY --from=build /app/packages/db/data ./data
ENV MIGRATIONS_FOLDER=/app/drizzle
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs
USER nodejs
EXPOSE 4000
ENV PORT=4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r=>{if(!r.ok)throw 1})" || exit 1
# Default = API. Workers reuse this image with `command: ["node","dist/workers/index.js"]`.
CMD ["node", "dist/index.js"]

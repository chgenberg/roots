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
EXPOSE 4000
ENV PORT=4000
CMD ["node", "dist/index.js"]

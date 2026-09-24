FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# Install all workspace dependencies once; later stages copy only the sources they need.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/core/package.json packages/core/
COPY packages/sdk/package.json packages/sdk/
RUN pnpm install --frozen-lockfile

FROM deps AS api
COPY tsconfig.base.json ./
COPY packages/core packages/core
COPY apps/api apps/api
WORKDIR /app/apps/api
ENV NODE_ENV=production PATH=/app/node_modules/.bin:$PATH
USER node
EXPOSE 8787
CMD ["tsx", "src/server.ts"]

FROM deps AS dashboard-build
COPY tsconfig.base.json ./
COPY packages/sdk packages/sdk
COPY apps/dashboard apps/dashboard
RUN pnpm --filter @jarvis/dashboard build

FROM node:22-slim AS dashboard
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=dashboard-build /app/apps/dashboard/.next/standalone ./
COPY --from=dashboard-build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]

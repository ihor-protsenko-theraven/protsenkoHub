# syntax=docker/dockerfile:1

FROM node:24-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY scripts ./scripts
COPY apps/api/prisma ./apps/api/prisma

RUN npm ci --include=dev

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web ./apps/web

RUN npm run build

FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV SERVE_WEB=true
ENV ALLOW_REGISTRATION=false
ENV PORT=3001

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY scripts ./scripts
COPY apps/api/prisma ./apps/api/prisma

# Install runtime dependencies for API + prisma CLI for startup migrations, then copy generated Prisma client.
RUN SKIP_PRISMA_GENERATE=1 npm ci --omit=dev --workspace=api --workspace=@protsenko/shared \
  && npm install --no-save prisma@6.19.0
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist/web/browser ./apps/web/dist/web/browser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/api/v1/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "scripts/docker-start.js"]

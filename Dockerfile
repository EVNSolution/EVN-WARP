# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/* && \
    npm ci

FROM dependencies AS builder
ARG WARP_RELEASE_ID=local
ARG WARP_SOURCE_REVISION=unknown
ENV NODE_ENV=production \
    DATABASE_URL=file:/tmp/warp-build.db \
    WARP_RELEASE_ID=${WARP_RELEASE_ID} \
    WARP_SOURCE_REVISION=${WARP_SOURCE_REVISION}
COPY . .
RUN --mount=type=secret,id=next_actions_key,required=true \
    export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/next_actions_key)" && \
    npx prisma generate && \
    npx prisma db push && \
    npm run build

FROM node:22-bookworm-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 AS runtime
ARG WARP_RELEASE_ID=local
ARG WARP_SOURCE_REVISION=unknown
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/* && \
    groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
LABEL org.opencontainers.image.revision=${WARP_SOURCE_REVISION} \
      ai.cleversystem.warp.release=${WARP_RELEASE_ID}
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

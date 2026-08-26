# syntax=docker/dockerfile:1.7
FROM node:22.23.1-alpine3.23@sha256:8516dce0483394d5708d4b2ee6cacb79fb1d617ea4e2787c2120bcca92ce372e AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN apk add --no-cache libc6-compat openssl && npm ci

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
RUN test ! -e .next/standalone/dev.db && \
    test ! -e .next/standalone/deploy && \
    ! find .next/standalone -type f \
      \( -name '.env*' -o -name '*.pem' -o -name '*.db' -o -name '*.xlsx' -o -name '*.docx' -o -name '*.pptx' \) \
      -print -quit | grep -q .

FROM node:22.23.1-alpine3.23@sha256:8516dce0483394d5708d4b2ee6cacb79fb1d617ea4e2787c2120bcca92ce372e AS runtime
ARG WARP_RELEASE_ID=local
ARG WARP_SOURCE_REVISION=unknown
RUN apk add --no-cache libc6-compat openssl && \
    addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
LABEL org.opencontainers.image.revision=${WARP_SOURCE_REVISION} \
      ai.cleversystem.warp.release=${WARP_RELEASE_ID}
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/data ./data-bundle
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

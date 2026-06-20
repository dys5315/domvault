# Constellation registry — production image. Bundles the TypeScript to a single JS
# file (esbuild) and runs it with plain `node` (not tsx-dev). Zero runtime deps.
#
# Storage is durable via a mounted volume at /data (STORE_DIR). No secrets baked in —
# PUBLISH_TOKEN and all config come from the host's env at runtime.
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY registry ./registry
RUN npx esbuild registry/server/main.ts --bundle --platform=node --format=esm --outfile=dist/registry.mjs

FROM node:20-slim
WORKDIR /app
# Run as the non-root 'node' user; /data is the mounted volume for the planet store.
COPY --from=build /app/dist/registry.mjs ./registry.mjs
RUN mkdir -p /data && chown -R node:node /data
USER node
ENV STORE_DIR=/data \
    PORT=8080 \
    RATE_LIMIT_PER_MIN=120 \
    LOG_REQUESTS=1
# PUBLISH_TOKEN (private-beta gate) and CORS_ORIGIN are injected by the host at runtime.
EXPOSE 8080
# Container healthcheck hits /healthz (no auth).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "registry.mjs"]

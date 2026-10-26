# ingest — build com CONTEXTO NA RAIZ (precisa de shared/ por causa da dep file:).
#   compose: build: { context: ., dockerfile: ingest/Dockerfile }
# Base Debian (slim) p/ binário pré-compilado do better-sqlite3 (glibc).

# ---- build ----
FROM node:22-slim AS build
# shared primeiro (dependência local)
WORKDIR /repo/shared
COPY shared/package.json shared/package-lock.json shared/tsconfig.json ./
COPY shared/src ./src
RUN npm ci --no-audit --no-fund && npm run build && npm prune --omit=dev
# ingest
WORKDIR /repo/ingest
COPY ingest/package.json ingest/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY ingest/tsconfig.json ./
COPY ingest/src ./src
# compila e descarta as devDependencies antes de copiar node_modules para o runtime
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/shared/package.json ./shared/
COPY --from=build /repo/shared/dist ./shared/dist
COPY --from=build /repo/shared/node_modules ./shared/node_modules
COPY --from=build /repo/ingest/package.json ./ingest/
COPY --from=build /repo/ingest/node_modules ./ingest/node_modules
COPY --from=build /repo/ingest/dist ./ingest/dist

# /data pertence ao node: o volume nomeado herda esse dono no 1º mount,
# permitindo a escrita da custódia rodando como não-root.
# runtime não precisa de npm/yarn: removidos para reduzir superfície de ataque
RUN mkdir -p /data && chown node:node /data \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
VOLUME /data

USER node
EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.INGEST_PORT||8081)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "ingest/dist/server.js"]

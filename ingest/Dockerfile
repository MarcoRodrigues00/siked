# ingest — build com CONTEXTO NA RAIZ (precisa de shared/ por causa da dep file:).
#   compose: build: { context: ., dockerfile: ingest/Dockerfile }
# Base Debian (slim) p/ binário pré-compilado do better-sqlite3 (glibc).

# ---- build ----
FROM node:20-slim AS build
WORKDIR /repo
# shared primeiro (dependência local)
COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
RUN cd shared && npm install --no-audit --no-fund && npm run build && npm prune --omit=dev
# ingest
COPY ingest/package.json ./ingest/
RUN cd ingest && npm install --no-audit --no-fund
COPY ingest/tsconfig.json ./ingest/
COPY ingest/src ./ingest/src
RUN cd ingest && npm run build

# ---- runtime ----
FROM node:20-slim AS runtime
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
RUN mkdir -p /data && chown node:node /data
VOLUME /data

USER node
EXPOSE 8081
CMD ["node", "ingest/dist/server.js"]

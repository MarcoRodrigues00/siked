# detection — build com CONTEXTO NA RAIZ (precisa de shared/ e mappings/).
#   compose: build: { context: ., dockerfile: detection/Dockerfile }

# ---- build ----
FROM node:20-slim AS build
WORKDIR /repo
COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
RUN cd shared && npm install --no-audit --no-fund && npm run build && npm prune --omit=dev
COPY detection/package.json ./detection/
RUN cd detection && npm install --no-audit --no-fund
COPY detection/tsconfig.json ./detection/
COPY detection/src ./detection/src
RUN cd detection && npm run build

# ---- runtime ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
ENV MAPPINGS_DIR=/repo/mappings
ENV RULES_DIR=/repo/detection/rules/signatures
WORKDIR /repo
COPY --from=build /repo/shared/package.json ./shared/
COPY --from=build /repo/shared/dist ./shared/dist
COPY --from=build /repo/shared/node_modules ./shared/node_modules
COPY --from=build /repo/detection/package.json ./detection/
COPY --from=build /repo/detection/node_modules ./detection/node_modules
COPY --from=build /repo/detection/dist ./detection/dist
# dados desacoplados de código: regras (YAML) e mapeamentos (JSON)
COPY detection/rules ./detection/rules
COPY mappings ./mappings

USER node
EXPOSE 8082
CMD ["node", "detection/dist/server.js"]

# detection — build com CONTEXTO NA RAIZ (precisa de shared/ e mappings/).
#   compose: build: { context: ., dockerfile: detection/Dockerfile }

# ---- build ----
FROM node:22-slim AS build
WORKDIR /repo/shared
COPY shared/package.json shared/package-lock.json shared/tsconfig.json ./
COPY shared/src ./src
RUN npm ci --no-audit --no-fund && npm run build && npm prune --omit=dev
WORKDIR /repo/detection
COPY detection/package.json detection/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY detection/tsconfig.json ./
COPY detection/src ./src
RUN npm run build

# ---- runtime ----
FROM node:22-slim AS runtime
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

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.DETECTION_PORT||8082)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "detection/dist/server.js"]

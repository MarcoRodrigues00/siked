# dashboard — WebSocket + UI React. Serviço na ponte core<->mgmt. Não-root.

# ---- build da UI (Vite) ----
FROM node:22-alpine AS ui
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY ui/ ./
RUN npm run build

# ---- build do servidor ----
FROM node:22-alpine AS server
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV UI_DIR=/app/ui/dist
WORKDIR /app
COPY package.json package-lock.json ./
# runtime não precisa de npm/yarn: removidos para reduzir superfície de ataque (e os CVEs que vêm junto)
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
COPY --from=server /app/dist ./dist
COPY --from=ui /app/ui/dist ./ui/dist

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.DASHBOARD_PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]

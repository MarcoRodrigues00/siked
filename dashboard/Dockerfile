# dashboard — WebSocket + UI React. Serviço na ponte core<->mgmt. Não-root.

# ---- build da UI (Vite) ----
FROM node:20-alpine AS ui
WORKDIR /app/ui
COPY ui/package.json ui/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY ui/ ./
RUN npm run build

# ---- build do servidor ----
FROM node:20-alpine AS server
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
ENV UI_DIR=/app/ui/dist
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=server /app/dist ./dist
COPY --from=ui /app/ui/dist ./ui/dist

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.DASHBOARD_PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]

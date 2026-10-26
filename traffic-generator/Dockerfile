# traffic-generator — roda cenários de ataque sintético e sai. Serviço on-demand.
# checkov:skip=CKV_DOCKER_2: job de execução única (roda os cenários e sai); HEALTHCHECK não se aplica
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/run.js"]

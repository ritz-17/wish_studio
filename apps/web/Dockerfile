# Build from the repository root: docker build -f apps/web/Dockerfile .
FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
RUN npm ci --workspace=@wish-studio/web

COPY apps/web apps/web
# NEXT_PUBLIC_API_URL is left unset so the browser calls the API on the same origin.
RUN npm run build --workspace=@wish-studio/web

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

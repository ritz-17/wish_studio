# Build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
RUN npm ci --workspace=@wish-studio/api --workspace=@wish-studio/database

COPY packages/database packages/database
COPY apps/api apps/api
RUN npm run generate --workspace=@wish-studio/database

ENV NODE_ENV=production API_PORT=4000
USER node
EXPOSE 4000
CMD ["node_modules/.bin/tsx", "apps/api/src/index.ts"]

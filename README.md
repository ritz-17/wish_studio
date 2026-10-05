# Wish Studio

Wish Studio is a small npm-workspaces monorepo for creating personal birthday, anniversary, retirement, and graduation wishes.

## Stack

- `apps/web`: Next.js App Router and TypeScript
- `apps/api`: Express HTTP API and WebSocket event stream
- `packages/database`: Prisma schema and shared Prisma Client
- PostgreSQL: local Docker Compose service

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- Docker Desktop or Docker Engine with Compose

## Run locally

From the repository root:

```bash
cp .env.example .env
npm install
npm run db:up
npm run db:generate
npm run db:migrate -- --name init
npm run dev
```

Open `http://localhost:3000`. The API health endpoint is `http://localhost:4000/api/health`; WebSocket events are served from `ws://localhost:4000/ws`.

The four-step flow is occasion, recipients (one to five), wish text, and preview. Saving stores the wish in PostgreSQL and broadcasts a `wish.created` event. Sharing and copying the wish text are also available from the preview step.

## Deployment

Step-by-step AWS (EC2) and GitHub Actions CI/CD guide: [docs/DEPLOY.md](docs/DEPLOY.md).

## Deployment notes

Set `DATABASE_URL` and `WEB_ORIGINS` for the deployment environment. `NEXT_PUBLIC_API_URL` is optional: it is embedded at build time, and when it is unset the browser calls the API on the same origin (the production setup routes `/api` and `/ws` through Caddy). Never commit `.env` or production credentials.
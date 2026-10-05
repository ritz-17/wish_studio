#!/usr/bin/env bash
# Runs on the server. Usage: deploy.sh <image-tag>
set -euo pipefail

cd "$(dirname "$0")/.."
export IMAGE_TAG="${1:-latest}"
compose="docker compose -f docker-compose.prod.yml"

echo "Deploying image tag ${IMAGE_TAG}"
$compose pull api web
$compose up -d postgres
$compose run --rm api node_modules/.bin/prisma migrate deploy --schema packages/database/prisma/schema.prisma
$compose up -d --remove-orphans

for attempt in $(seq 1 30); do
  if curl -fsS http://localhost/api/health >/dev/null 2>&1; then
    echo "Healthy after ${attempt}s"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 1
done

echo "API did not become healthy in time" >&2
$compose ps
$compose logs --tail=50 api
exit 1

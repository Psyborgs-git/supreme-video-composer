#!/bin/bash
set -euo pipefail

# Builds and tags the Docker image for local use and optional registry push
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.1.0")

docker build \
  --tag media-studio:latest \
  --tag "media-studio:${VERSION}" \
  --build-arg "BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --build-arg "VERSION=${VERSION}" \
  .

echo ""
echo "Built media-studio:${VERSION} and media-studio:latest"
echo "Run with: docker-compose up"

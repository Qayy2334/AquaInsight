#!/usr/bin/env bash
# Build x86-64 (linux/amd64) images for Windows / Intel PCs and write them to docker-images/.
# Works from an Apple Silicon Mac via Docker Desktop's emulation. Output tars are loadable
# with `docker load` (start-windows.bat does this automatically). Local images are untouched.
set -euo pipefail
cd "$(dirname "$0")/.."

PLATFORM="${PLATFORM:-linux/amd64}"
OUT="docker-images"
mkdir -p "$OUT"

# The default "docker" driver cannot export image tarballs; use a dedicated container builder.
BUILDER="aquainsight-builder"
docker buildx inspect "$BUILDER" >/dev/null 2>&1 || docker buildx create --name "$BUILDER" --driver docker-container >/dev/null
BX=(docker buildx build --builder "$BUILDER" --platform "$PLATFORM")

echo "==> backend ($PLATFORM)"
"${BX[@]}" -t aquainsight-backend:latest \
  --output "type=docker,dest=$OUT/aquainsight-backend.tar" ./backend

echo "==> frontend ($PLATFORM)"
"${BX[@]}" -t aquainsight-frontend:latest \
  --output "type=docker,dest=$OUT/aquainsight-frontend.tar" ./frontend

echo "==> mysql:8.0 ($PLATFORM)"
tmp="$(mktemp -d)"
echo "FROM mysql:8.0" > "$tmp/Dockerfile"
"${BX[@]}" -t mysql:8.0 \
  --output "type=docker,dest=$OUT/mysql-8.0.tar" "$tmp"
rm -rf "$tmp"

ls -lh "$OUT"
echo "Done. Ship the project folder together with $OUT/."

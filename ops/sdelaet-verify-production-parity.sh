#!/usr/bin/env bash
set -euo pipefail

EXPECTED_SHA="${1:-}"
REPO_DIR='/home/sdelaet-runner/deploy-repo'
CURRENT='/opt/sdelaet/current'
WEBROOT='/var/www/www-root/data/www/onsdelaet.ru'
STATE_DIR='/var/lib/sdelaet/deploy'
DRIFT_LOG="$STATE_DIR/last-production-drift.txt"

if [[ ! "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'PRODUCTION_PARITY_EXPECTED_SHA_INVALID'
  exit 40
fi
if [ ! -d "$REPO_DIR/.git" ]; then
  echo 'PRODUCTION_PARITY_REPO_MISSING'
  exit 40
fi

mkdir -p "$STATE_DIR"
TMP="$(mktemp -d)"
DRIFT="$(mktemp)"
cleanup(){ rm -rf "$TMP" "$DRIFT"; }
trap cleanup EXIT

if ! runuser -u sdelaet-runner -- git -C "$REPO_DIR" cat-file -e "$EXPECTED_SHA^{commit}" 2>/dev/null; then
  runuser -u sdelaet-runner -- git -C "$REPO_DIR" fetch --depth=1 origin "$EXPECTED_SHA" >/dev/null 2>&1 || {
    echo 'PRODUCTION_PARITY_BASE_SHA_UNAVAILABLE'
    exit 40
  }
fi

runuser -u sdelaet-runner -- git -C "$REPO_DIR" archive "$EXPECTED_SHA" | tar -x -C "$TMP"

record(){ printf '%s\n' "$1" >> "$DRIFT"; }

# 1. Every source-owned file previously deployed to /opt/sdelaet/current must still
# match the last deployed Git SHA. This catches direct server edits before overwrite.
while IFS= read -r rel; do
  case "$rel" in
    .github/*|search-api/*) continue ;;
  esac
  expected="$TMP/$rel"
  production="$CURRENT/$rel"
  [ -f "$expected" ] || continue
  if [ ! -f "$production" ]; then
    record "MISSING_CURRENT $rel"
  elif ! cmp -s "$expected" "$production"; then
    record "MODIFIED_CURRENT $rel"
  fi
done < <(runuser -u sdelaet-runner -- git -C "$REPO_DIR" ls-tree -r --name-only "$EXPECTED_SHA")

# 2. Public webroot files are checked independently because historically they were
# edited directly without updating /opt/sdelaet/current.
while IFS= read -r rel; do
  case "$rel" in
    assets/*)
      expected="$TMP/$rel"; production="$WEBROOT/$rel" ;;
    uslugi/*/index.html)
      expected="$TMP/$rel"; production="$WEBROOT/$rel" ;;
    *.html|robots.txt|sitemap*.xml|manifest.webmanifest)
      expected="$TMP/$rel"; production="$WEBROOT/$rel" ;;
    *) continue ;;
  esac
  [ -f "$expected" ] || continue
  if [ ! -f "$production" ]; then
    record "MISSING_WEBROOT $rel"
  elif ! cmp -s "$expected" "$production"; then
    record "MODIFIED_WEBROOT $rel"
  fi
done < <(runuser -u sdelaet-runner -- git -C "$REPO_DIR" ls-tree -r --name-only "$EXPECTED_SHA")

# 3. Detect new server-only runtime/source files that Git did not know about.
# Backup/preview/generated regional output is intentionally excluded.
for production in "$CURRENT"/src/* "$CURRENT"/config/*.json; do
  [ -f "$production" ] || continue
  rel="${production#"$CURRENT"/}"
  case "$rel" in
    *.bak*|*.before-*|*__pycache__*) continue ;;
  esac
  [ -f "$TMP/$rel" ] || record "SERVER_ONLY_CURRENT $rel"
done

for production in "$WEBROOT"/*.html; do
  [ -f "$production" ] || continue
  rel="${production#"$WEBROOT"/}"
  [ -f "$TMP/$rel" ] || record "SERVER_ONLY_WEBROOT $rel"
done

if [ -d "$WEBROOT/assets" ]; then
  while IFS= read -r -d '' production; do
    rel="${production#"$WEBROOT"/}"
    case "$rel" in
      assets/deploy-version.txt|*.bak*|*.broken*|*backup-*) continue ;;
    esac
    [ -f "$TMP/$rel" ] || record "SERVER_ONLY_WEBROOT $rel"
  done < <(find "$WEBROOT/assets" -type f \( -name '*.js' -o -name '*.css' -o -name '*.json' -o -name '*.svg' \) -print0)
fi

if [ -d "$WEBROOT/uslugi" ]; then
  while IFS= read -r -d '' production; do
    rel="${production#"$WEBROOT"/}"
    [ -f "$TMP/$rel" ] || record "SERVER_ONLY_WEBROOT $rel"
  done < <(find "$WEBROOT/uslugi" -mindepth 2 -maxdepth 2 -type f -name index.html -print0)
fi

if [ -s "$DRIFT" ]; then
  sort -u "$DRIFT" > "$DRIFT_LOG"
  chmod 0644 "$DRIFT_LOG"
  echo "DEPLOY_PRODUCTION_DRIFT_DETECTED expected_sha=$EXPECTED_SHA"
  cat "$DRIFT_LOG"
  echo 'DEPLOY_BLOCKED: reconcile production changes into Git before publishing.'
  exit 42
fi

: > "$DRIFT_LOG"
chmod 0644 "$DRIFT_LOG"
echo "PRODUCTION_PARITY_PASS sha=$EXPECTED_SHA"

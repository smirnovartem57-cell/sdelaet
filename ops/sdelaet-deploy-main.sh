#!/usr/bin/env bash
set -euo pipefail

REPO_URL='https://github.com/smirnovartem57-cell/sdelaet.git'
REPO_DIR='/home/sdelaet-runner/deploy-repo'
CURRENT='/opt/sdelaet/current'
WEBROOT='/var/www/www-root/data/www/onsdelaet.ru'
STATE_DIR='/var/lib/sdelaet/deploy'
STATE_FILE="$STATE_DIR/main.sha"
BACKUP_ROOT='/opt/sdelaet/backups/auto-main'
NODE='/opt/sdelaet/runtime/node24/bin/node'
DEPLOY_USER='sdelaet-runner'

mkdir -p "$STATE_DIR" "$BACKUP_ROOT" "$CURRENT" "$WEBROOT"
REMOTE_SHA="$(git ls-remote "$REPO_URL" refs/heads/main | awk '{print $1}')"
test "$REMOTE_SHA" != '' || { echo 'DEPLOY_REMOTE_SHA_MISSING'; exit 1; }
CURRENT_SHA="$(cat "$STATE_FILE" 2>/dev/null || true)"
if [ "$CURRENT_SHA" = "$REMOTE_SHA" ]; then
  echo "DEPLOY_NO_CHANGE sha=$REMOTE_SHA"
  exit 0
fi

if [ ! -d "$REPO_DIR/.git" ]; then
  rm -rf "$REPO_DIR"
  runuser -u "$DEPLOY_USER" -- git clone --depth=1 --branch main "$REPO_URL" "$REPO_DIR"
else
  runuser -u "$DEPLOY_USER" -- git -C "$REPO_DIR" fetch --depth=1 origin main
  runuser -u "$DEPLOY_USER" -- git -C "$REPO_DIR" reset --hard FETCH_HEAD
  runuser -u "$DEPLOY_USER" -- git -C "$REPO_DIR" clean -fdx
fi

SOURCE_SHA="$(runuser -u "$DEPLOY_USER" -- git -C "$REPO_DIR" rev-parse HEAD)"
test "$SOURCE_SHA" = "$REMOTE_SHA" || { echo 'DEPLOY_SHA_MISMATCH'; exit 1; }

runuser -u "$DEPLOY_USER" -- bash -lc "cd '$REPO_DIR' && '$NODE' tools/platform-readiness.mjs"
runuser -u "$DEPLOY_USER" -- bash -lc "cd '$REPO_DIR' && '$NODE' tests/metrika-goals-regression.mjs"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$BACKUP_ROOT/$STAMP-$SOURCE_SHA"
mkdir -p "$BACKUP/current" "$BACKUP/webroot"
cp -al "$CURRENT/." "$BACKUP/current/" 2>/dev/null || cp -a "$CURRENT/." "$BACKUP/current/"
mkdir -p "$BACKUP/webroot/assets" "$BACKUP/webroot/uslugi"
[ ! -d "$WEBROOT/assets" ] || cp -al "$WEBROOT/assets/." "$BACKUP/webroot/assets/" 2>/dev/null || cp -a "$WEBROOT/assets/." "$BACKUP/webroot/assets/"
[ ! -d "$WEBROOT/uslugi" ] || cp -al "$WEBROOT/uslugi/." "$BACKUP/webroot/uslugi/" 2>/dev/null || cp -a "$WEBROOT/uslugi/." "$BACKUP/webroot/uslugi/"
for file in "$WEBROOT"/*.html "$WEBROOT"/robots.txt "$WEBROOT"/sitemap*.xml "$WEBROOT"/manifest.webmanifest; do
  [ ! -f "$file" ] || cp -a "$file" "$BACKUP/webroot/"
done
echo "DEPLOY_BACKUP=$BACKUP"

rsync -a --exclude='.git/' --exclude='.github/' --exclude='search-api/' "$REPO_DIR/" "$CURRENT/"
mkdir -p "$WEBROOT/assets" "$WEBROOT/uslugi"
rsync -a "$REPO_DIR/assets/" "$WEBROOT/assets/"
[ ! -d "$REPO_DIR/uslugi" ] || rsync -a "$REPO_DIR/uslugi/" "$WEBROOT/uslugi/"

for file in "$REPO_DIR"/*.html "$REPO_DIR"/robots.txt "$REPO_DIR"/sitemap*.xml "$REPO_DIR"/manifest.webmanifest; do
  [ ! -f "$file" ] || install -m 0644 "$file" "$WEBROOT/$(basename "$file")"
done

"$NODE" --check "$CURRENT/src/offer-contract.mjs"
"$NODE" --check "$CURRENT/src/offer-contract-gap-engine.mjs"
"$NODE" --check "$CURRENT/src/offer-pipeline.mjs"
if systemctl list-unit-files | grep -q '^sdelaet-api.service'; then
  systemctl restart sdelaet-api.service
  sleep 1
  systemctl is-active --quiet sdelaet-api.service
  curl -fsS http://127.0.0.1:3210/health >/dev/null
fi

grep -q '112503660' "$WEBROOT/assets/prod-ui.js"
printf '%s\n' "$SOURCE_SHA" > "$STATE_FILE"
printf '%s\n' "$SOURCE_SHA" > "$WEBROOT/assets/deploy-version.txt"
chmod 0644 "$STATE_FILE" "$WEBROOT/assets/deploy-version.txt"

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
  sort -nr | tail -n +11 | cut -d' ' -f2- | xargs -r rm -rf

echo "DEPLOY_PASS sha=$SOURCE_SHA"

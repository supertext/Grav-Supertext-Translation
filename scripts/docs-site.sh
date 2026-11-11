# Sourced by docs-screenshots.sh and docs-movie.sh: builds a throwaway Grav site with the demo's
# entrypoint (random local-only passwords) and starts the stand-in Supertext API and Grav.
#
#   . scripts/docs-site.sh
#   start_site screenshots          # work folder name under $CACHE; SITE_API_KEY= (empty) starts without an API key
#   … BASE, ADMIN_PASSWORD, EDITOR_PASSWORD are set; $WORK/stand-in.log is the stand-in's log …
#   stop_site
#
# Needs PHP 8.3 with curl. Grav comes from its GitHub release, cached in $CACHE (CACHE_DIR=…).
REPO=$(pwd)
CACHE=${CACHE_DIR:-$REPO/.cache}
GRAV_VERSION=${GRAV_VERSION:-2.2.29}
GRAV_PORT=${GRAV_PORT:-8090}
API_PORT=${API_PORT:-8089}
BASE="http://127.0.0.1:$GRAV_PORT"

start_site() {
  WORK="$CACHE/$1"
  mkdir -p "$CACHE"
  if [ ! -f "$CACHE/grav-admin-$GRAV_VERSION.zip" ]; then
    echo "Downloading Grav $GRAV_VERSION…"
    # GitHub release asset, as in demo/Dockerfile (getgrav.org only serves the latest version).
    curl -fsSL -o "$CACHE/grav-admin-$GRAV_VERSION.zip" "https://github.com/getgrav/grav/releases/download/$GRAV_VERSION/grav-admin-v$GRAV_VERSION.zip"
  fi
  rm -rf "$WORK" && mkdir -p "$WORK"
  unzip -q "$CACHE/grav-admin-$GRAV_VERSION.zip" -d "$WORK"
  mv "$WORK/grav-admin" "$WORK/grav"
  cp -a "$WORK/grav/user" "$WORK/seed-user"

  # The plugin, as the demo image installs it.
  mkdir -p "$WORK/grav/user/plugins/supertext-translation"
  cp -r supertext-translation.php supertext-translation.yaml blueprints.yaml languages.yaml classes admin-next lib \
    "$WORK/grav/user/plugins/supertext-translation/"

  # Throwaway accounts for this local site only.
  ADMIN_PASSWORD="Shot$(php -r 'echo bin2hex(random_bytes(6));')9"
  EDITOR_PASSWORD="Shot$(php -r 'echo bin2hex(random_bytes(6));')8"
  export ADMIN_PASSWORD EDITOR_PASSWORD BASE
  GRAV_ROOT="$WORK/grav" DEMO_SRC="$REPO/demo" SEED_USER="$WORK/seed-user" DATA_DIR="$WORK/data" DEMO_NO_SERVER=1 \
    DEMO_ADMIN_EMAIL=admin@demo.example DEMO_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    DEMO_EDITOR_EMAIL=editor@demo.example DEMO_EDITOR_PASSWORD="$EDITOR_PASSWORD" \
    sh demo/entrypoint.sh

  php -S "127.0.0.1:$API_PORT" scripts/stand-in-api/router.php > "$WORK/stand-in.log" 2>&1 &
  API_PID=$!
  # The stand-in also answers the Commando Center's reports, so nothing is reported to Supertext.
  (cd "$WORK/grav" && SUPERTEXT_API_KEY="${SITE_API_KEY-Supertext-Auth-Key stand-in}" SUPERTEXT_API_URL="http://127.0.0.1:$API_PORT/v1/" \
    SUPERTEXT_REPORT_URL="http://127.0.0.1:$API_PORT/api/v1/report" \
    exec php -S "127.0.0.1:$GRAV_PORT" system/router.php > "$WORK/grav.log" 2>&1) &
  GRAV_PID=$!
  trap stop_site EXIT
  sleep 2
}

stop_site() {
  kill $API_PID $GRAV_PID 2>/dev/null || true
  wait $API_PID $GRAV_PID 2>/dev/null || true
}

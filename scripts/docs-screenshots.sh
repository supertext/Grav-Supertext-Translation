#!/bin/sh
# Regenerates the screenshots in docs/images/ from the demo. With LIVE_API_KEY (CI: the secret
# SUPERTEXT_API_KEY) the demo translates with the real Supertext API, so the images show real
# translations; without it, against the stand-in Supertext API (scripts/stand-in-api).
#
#   composer docs:screenshots
#
# Needs PHP 8.3 with curl, Python 3 with Playwright (pip install playwright && playwright install chromium).
# Builds a throwaway Grav site in .cache/screenshots (CACHE_DIR=… to put it elsewhere; see docs-site.sh).
set -e
cd "$(dirname "$0")/.."
. scripts/docs-site.sh
start_site screenshots

OUT="$REPO/docs/images" python3 scripts/screenshots.py

if [ -z "${LIVE_API_KEY:-}" ] && grep -q "no translation for" "$WORK/stand-in.log"; then
  echo "Some text had no stand-in translation (see $WORK/stand-in.log); add it to scripts/stand-in-api/translations.php." >&2
  exit 1
fi
echo "Screenshots written to docs/images/"

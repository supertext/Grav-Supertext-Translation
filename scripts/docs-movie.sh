#!/bin/sh
# Records a movie from the demo, against the stand-in Supertext API (see docs/DEVELOPER.md → Demo movie):
#
#   composer docs:movie            # demo movie: docs/images/demo.gif + scripts/movie/out/Grav-Supertext-Translation.mp4
#   composer docs:movie:install    # install movie: scripts/movie/out/Grav-Supertext-Translation-install.mp4
#
# Needs PHP 8.3 with curl, Node.js 20+, ffmpeg, and for the voice Piper (pip install piper-tts; MOVIE_VOICE=0: silent).
# Builds a fresh throwaway Grav site in .cache/movie-<kind> (see docs-site.sh).
set -e
cd "$(dirname "$0")/.."
KIND=${1:-demo}
[ -d scripts/movie/node_modules/playwright ] || (cd scripts/movie && npm install --no-audit --no-fund)

. scripts/docs-site.sh
if [ "$KIND" = install ]; then
  # No key in the environment: the movie types a made-up key into the settings (the stand-in accepts any key).
  SITE_API_KEY= start_site movie-install
else
  start_site movie-demo
fi

node "scripts/movie/$KIND.mjs"

if grep -q "no translation for" "$WORK/stand-in.log"; then
  echo "Some text had no stand-in translation (see $WORK/stand-in.log); add it to scripts/stand-in-api/translations.php." >&2
  exit 1
fi

#!/usr/bin/env sh
# Checks a running taskdeck container (default http://localhost:8080):
# status codes, the SPA fallback, cache headers and gzip.
# Usage: scripts/docker-smoke.sh [base-url]
set -eu

BASE="${1:-http://localhost:8080}"
failures=0

check() {
  label="$1"
  shift
  if "$@"; then
    echo "ok   $label"
  else
    echo "FAIL $label"
    failures=$((failures + 1))
  fi
}

status() { curl -s -o /dev/null -w '%{http_code}' "$BASE$1"; }
header() { curl -s -D - -o /dev/null ${3:-} "$BASE$1" | tr -d '\r' | grep -i "^$2:" | head -n 1; }

asset=$(curl -s "$BASE/" | grep -o '/assets/index-[^"]*\.js' | head -n 1)
# sw.js imports the runtime as ./workbox-<hash> (without .js).
workbox="$(curl -s "$BASE/sw.js" | grep -o 'workbox-[0-9a-f]\{6,\}' | head -n 1).js"

check "/ responds 200" test "$(status /)" = 200
check "unknown path falls back to index.html" sh -c "curl -s '$BASE/no/such/page' | grep -q 'id=\"root\"'"
check "unknown path responds 200" test "$(status /no/such/page)" = 200
check "index.html: no-cache" sh -c "echo '$(header /index.html cache-control)' | grep -qi 'no-cache'"
check "/ (index): no-cache" sh -c "echo '$(header / cache-control)' | grep -qi 'no-cache'"
check "sw.js: no-cache" sh -c "echo '$(header /sw.js cache-control)' | grep -qi 'no-cache'"
check "manifest: no-cache" sh -c "echo '$(header /manifest.webmanifest cache-control)' | grep -qi 'no-cache'"
check "manifest: application/manifest+json" sh -c "echo '$(header /manifest.webmanifest content-type)' | grep -qi 'application/manifest+json'"
check "hashed asset ($asset): immutable, 1 year" sh -c "echo '$(header "$asset" cache-control)' | grep -qi 'max-age=31536000, immutable'"
check "workbox runtime ($workbox): immutable" sh -c "echo '$(header "/$workbox" cache-control)' | grep -qi 'immutable'"
check "hashed asset is gzipped" sh -c "echo '$(header "$asset" content-encoding "-H Accept-Encoding:gzip")' | grep -qi 'gzip'"

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"

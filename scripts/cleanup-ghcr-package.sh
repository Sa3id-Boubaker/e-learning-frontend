#!/usr/bin/env bash
set -euo pipefail

# Deletes old GHCR container package versions, keeping only the most recent
# N tagged builds (plus any untagged manifests created alongside them, e.g.
# buildkit attestations, which share the same timestamp window).
#
# Required env vars: REGISTRY_TOKEN, REGISTRY_NAMESPACE, PACKAGE_NAME
# Optional: KEEP_VERSIONS (default 3)
# The token bound to REGISTRY_TOKEN must have the "delete:packages" scope
# in addition to "write:packages", otherwise the API calls below will fail
# with 403/404 and this script will just warn and skip cleanup for that
# package (it will not fail the build).

: "${REGISTRY_TOKEN:?REGISTRY_TOKEN is not set}"
: "${REGISTRY_NAMESPACE:?REGISTRY_NAMESPACE is not set}"
: "${PACKAGE_NAME:?PACKAGE_NAME is not set}"
KEEP_VERSIONS="${KEEP_VERSIONS:-3}"

API="https://api.github.com/users/${REGISTRY_NAMESPACE}/packages/container/${PACKAGE_NAME}/versions?per_page=100"

if ! VERSIONS_JSON=$(curl -sf \
  -H "Authorization: Bearer ${REGISTRY_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "$API"); then
  echo "WARNING: could not list versions for ${PACKAGE_NAME} (check that the token has read:packages/delete:packages scope). Skipping cleanup for this package."
  exit 0
fi

CUTOFF=$(echo "$VERSIONS_JSON" | jq -r --argjson keep "$KEEP_VERSIONS" '
  [ .[] | select((.metadata.container.tags // []) | length > 0) ]
  | sort_by(.created_at) | reverse
  | .[$keep - 1].created_at // empty
')

if [ -z "$CUTOFF" ]; then
  echo "${PACKAGE_NAME}: fewer than ${KEEP_VERSIONS} tagged versions exist, nothing to clean up."
  exit 0
fi

echo "${PACKAGE_NAME}: keeping versions from ${CUTOFF} onward, deleting anything older."

echo "$VERSIONS_JSON" | jq -r --arg cutoff "$CUTOFF" '.[] | select(.created_at < $cutoff) | .id' | while read -r VID; do
  [ -z "$VID" ] && continue
  echo "  deleting version id ${VID}"
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE \
    -H "Authorization: Bearer ${REGISTRY_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/users/${REGISTRY_NAMESPACE}/packages/container/${PACKAGE_NAME}/versions/${VID}")
  echo "    -> HTTP ${HTTP_CODE}"
done

echo "${PACKAGE_NAME}: cleanup done."

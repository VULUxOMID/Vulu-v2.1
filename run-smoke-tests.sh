#!/usr/bin/env bash
set -euo pipefail

# Firestore Rules Smoke Test (Production)
#
# Requirements:
# - FIREBASE_TOKEN: Firebase ID token for an authenticated user (test host)
# - FIREBASE_UID: UID of the same authenticated user
# - PROJECT_ID: (optional) Firebase project ID, defaults to 'vulugo'
#
# This script performs minimal reads/writes to verify Firestore rules:
# 1) Create a stream (isActive=false) with hostId = FIREBASE_UID (should succeed)
# 2) Update the stream as host (should succeed)
# 3) Create participants/{FIREBASE_UID} (should succeed)
# 4) Create chat message (should succeed)
# 5) (Optional) Attempt update as another user (should fail) if FIREBASE_TOKEN_OTHER is set
# 6) Cleanup created docs (optional) unless KEEP_DOCS=1
#
# NOTE: Uses Firestore REST API. ID token must be a Firebase Auth ID token, not a Google OAuth token.

PROJECT_ID="${PROJECT_ID:-vulugo}"
if [[ -z "${FIREBASE_TOKEN:-}" || -z "${FIREBASE_UID:-}" ]]; then
  echo "❌ Please set FIREBASE_TOKEN and FIREBASE_UID environment variables."
  echo "   Example: FIREBASE_UID=... FIREBASE_TOKEN=... ./run-smoke-tests.sh"
  exit 1
fi

API="https://firestore.googleapis.com/v1"
DB_PATH="projects/${PROJECT_ID}/databases/(default)/documents"

TS=$(date +%s)
STREAM_ID="rules-smoke-${TS}"
STREAM_DOC_PATH="streams/${STREAM_ID}"
PARTICIPANT_DOC_PATH="streams/${STREAM_ID}/participants/${FIREBASE_UID}"
CHAT_COL_PATH="streams/${STREAM_ID}/chat"

auth_header=("Authorization: Bearer ${FIREBASE_TOKEN}")
json() { echo "$1" | jq -c .; }

step() { echo; echo "==> $1"; }
ok() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

# 1) Create stream with isActive=false
step "Create stream ${STREAM_ID} (hostId=${FIREBASE_UID}, isActive=false)"
create_body=$(json "{
  \"fields\": {
    \"hostId\": {\"stringValue\": \"${FIREBASE_UID}\"},
    \"isActive\": {\"booleanValue\": false},
    \"title\": {\"stringValue\": \"Smoke Test Stream ${TS}\"}
  }
}")

set +e
resp=$(curl -s -w "\n%{http_code}" -X PATCH \
  "${API}/${DB_PATH}/${STREAM_DOC_PATH}" \
  -H "Content-Type: application/json" \
  -H "X-Goog-Api-Client: rules-smoke-test" \
  -H "X-Goog-User-Project: ${PROJECT_ID}" \
  -H "${auth_header}" \
  -d "${create_body}")
body=${resp%$'\n'*}
code=${resp##*$'\n'}
set -e

if [[ "$code" == "200" ]]; then
  ok "Stream created"
else
  echo "$body" | sed 's/.\{200\}/&\n/g'
  fail "Stream create failed (HTTP ${code})"
fi

# 2) Update stream as host (set description)
step "Update stream as host (should succeed)"
update_body=$(json "{ \"fields\": { \"description\": {\"stringValue\": \"Updated by host\"} } }")
set +e
resp=$(curl -s -w "\n%{http_code}" -X PATCH \
  "${API}/${DB_PATH}/${STREAM_DOC_PATH}?updateMask.fieldPaths=description" \
  -H "Content-Type: application/json" -H "${auth_header}" \
  -d "${update_body}")
body=${resp%$'\n'*}
code=${resp##*$'\n'}
set -e

if [[ "$code" == "200" ]]; then
  ok "Host update allowed"
else
  echo "$body"
  fail "Host update denied (HTTP ${code})"
fi

# 3) Create/Update participant doc for host
step "Create participant doc for host (should succeed)"
participant_body=$(json "{
  \"fields\": {
    \"userId\": {\"stringValue\": \"${FIREBASE_UID}\"},
    \"isActive\": {\"booleanValue\": true},
    \"joinedAt\": {\"integerValue\": ${TS} }
  }
}")
set +e
resp=$(curl -s -w "\n%{http_code}" -X PATCH \
  "${API}/${DB_PATH}/${PARTICIPANT_DOC_PATH}" \
  -H "Content-Type: application/json" -H "${auth_header}" \
  -d "${participant_body}")
body=${resp%$'\n'*}
code=${resp##*$'\n'}
set -e

if [[ "$code" == "200" ]]; then
  ok "Participant doc created/updated"
else
  echo "$body"
  fail "Participant create/update denied (HTTP ${code})"
fi

# 4) Create a chat message
step "Create chat message (should succeed)"
chat_body=$(json "{
  \"fields\": {
    \"streamId\": {\"stringValue\": \"${STREAM_ID}\"},
    \"senderId\": {\"stringValue\": \"${FIREBASE_UID}\"},
    \"senderName\": {\"stringValue\": \"Test Host\"},
    \"message\": {\"stringValue\": \"Hello from smoke test\"},
    \"type\": {\"stringValue\": \"text\"},
    \"timestamp\": {\"timestampValue\": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
  }
}")
set +e
resp=$(curl -s -w "\n%{http_code}" -X POST \
  "${API}/${DB_PATH}/${CHAT_COL_PATH}" \
  -H "Content-Type: application/json" -H "${auth_header}" \
  -d "${chat_body}")
body=${resp%$'\n'*}
code=${resp##*$'\n'}
set -e

if [[ "$code" == "200" ]]; then
  ok "Chat message created"
else
  echo "$body"
  fail "Chat create denied (HTTP ${code})"
fi

# 5) Optional: attempt update as another authenticated user (should be denied)
if [[ -n "${FIREBASE_TOKEN_OTHER:-}" ]]; then
  step "Attempt update as another user (should be denied)"
  auth_header_other=("Authorization: Bearer ${FIREBASE_TOKEN_OTHER}")
  bad_update=$(json "{ \"fields\": { \"title\": {\"stringValue\": \"Hacked\"} } }")
  set +e
  resp=$(curl -s -w "\n%{http_code}" -X PATCH \
    "${API}/${DB_PATH}/${STREAM_DOC_PATH}?updateMask.fieldPaths=title" \
    -H "Content-Type: application/json" -H "${auth_header_other}" \
    -d "${bad_update}")
  body=${resp%$'\n'*}
  code=${resp##*$'\n'}
  set -e
  if [[ "$code" == "200" ]]; then
    echo "$body"
    fail "Unexpectedly allowed non-host update"
  else
    ok "Non-host update denied as expected (HTTP ${code})"
  fi
fi

# 6) Cleanup unless KEEP_DOCS=1
if [[ "${KEEP_DOCS:-0}" != "1" ]]; then
  step "Cleanup created docs"
  set +e
  curl -s -o /dev/null -w "%{http_code}\n" -X DELETE \
    "${API}/${DB_PATH}/${STREAM_DOC_PATH}" -H "${auth_header}" >/dev/null
  set -e
  ok "Cleanup attempted (best-effort)"
fi

echo
ok "Smoke tests completed successfully"


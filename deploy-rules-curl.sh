#!/bin/bash

# Firebase Rules Deployment via REST API
# This bypasses the Firebase CLI Node.js version requirement

echo "🔥 Firebase Rules Deployment via REST API"
echo "========================================="

PROJECT_ID="vulugo"
RULES_FILE="firestore.rules"

# Check if rules file exists
if [ ! -f "$RULES_FILE" ]; then
    echo "❌ Error: $RULES_FILE not found"
    exit 1
fi

echo "📋 Project ID: $PROJECT_ID"
echo "📄 Rules file: $RULES_FILE"
echo ""

# Get Firebase access token
if [ -z "$ACCESS_TOKEN" ]; then
  echo "🔐 Getting Firebase access token..."
  echo "Please run this command in a separate terminal and paste the access token:"
  echo ""
  echo "gcloud auth print-access-token"
  echo ""
  echo "If you don't have gcloud CLI, you can:"
  echo "1. Go to https://console.cloud.google.com/apis/credentials"
  echo "2. Create a service account key"
  echo "3. Use that for authentication"
  echo ""
  read -p "Enter your Firebase access token: " ACCESS_TOKEN
fi

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ No access token provided"
    exit 1
fi

# Read rules file content
RULES_CONTENT=$(cat "$RULES_FILE")

# Create JSON payload
cat > rules_payload.json << EOF
{
  "source": {
    "files": [
      {
        "name": "firestore.rules",
        "content": $(echo "$RULES_CONTENT" | jq -Rs .)
      }
    ]
  }
}
EOF

echo "🚀 Deploying rules to Firebase..."

# Deploy rules via REST API (create ruleset)
RESPONSE=$(curl -s -X POST \
  "https://firebaserules.googleapis.com/v1/projects/$PROJECT_ID/rulesets" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Goog-User-Project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d @rules_payload.json)

echo "Response: $RESPONSE"

# Check if ruleset creation was successful
if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ Ruleset creation failed"
    echo "$RESPONSE"
    rm -f rules_payload.json
    exit 1
fi

# Extract ruleset name
RULESET_NAME=$(echo "$RESPONSE" | sed -n 's/.*"name": "\([^"]*\)".*/\1/p' | head -n1)
if [ -z "$RULESET_NAME" ]; then
  echo "❌ Failed to extract ruleset name"
  rm -f rules_payload.json
  exit 1
fi

echo "📦 Created ruleset: $RULESET_NAME"

echo "🔗 Updating release to point to new ruleset..."
RELEASE_NAME="projects/$PROJECT_ID/releases/cloud.firestore"

# Try to create or update the release
CREATE_RESPONSE=$(curl -s -X POST \
  "https://firebaserules.googleapis.com/v1/projects/$PROJECT_ID/releases" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Goog-User-Project: $PROJECT_ID" \
  -H "Content-Type: application/json" \
  -d "{ \"name\": \"$RELEASE_NAME\", \"rulesetName\": \"$RULESET_NAME\" }")

echo "Create release response: $CREATE_RESPONSE"

if echo "$CREATE_RESPONSE" | grep -q "ALREADY_EXISTS"; then
  echo "ℹ️ Release exists; updating it..."
  RELEASE_RESPONSE=$(curl -s -X PATCH \
    "https://firebaserules.googleapis.com/v1/$RELEASE_NAME?updateMask=release.rulesetName" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "X-Goog-User-Project: $PROJECT_ID" \
    -H "Content-Type: application/json" \
    -d "{ \"release\": { \"name\": \"$RELEASE_NAME\", \"rulesetName\": \"$RULESET_NAME\" } }")
  echo "Update response: $RELEASE_RESPONSE"
  if echo "$RELEASE_RESPONSE" | grep -q "error"; then
    echo "❌ Release update failed"
    echo "$RELEASE_RESPONSE"
    rm -f rules_payload.json
    exit 1
  fi
elif echo "$CREATE_RESPONSE" | grep -q "error"; then
  echo "❌ Release creation failed"
  echo "$CREATE_RESPONSE"
  rm -f rules_payload.json
  exit 1
fi

echo "✅ Firestore rules deployed and released successfully!"

# Cleanup
rm -f rules_payload.json

echo ""
echo "📝 Next steps:"
echo "1. Verify Firestore rules in Console (Firestore → Rules)"
echo "2. Test DM read/write as participants and verify encryption key docs access"
echo "3. If any permission errors occur, ensure the Firebase Rules API is enabled and billing/quota is configured for project: $PROJECT_ID"

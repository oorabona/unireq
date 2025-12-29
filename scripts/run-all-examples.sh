#!/bin/bash
# Run all examples sequentially
# Auto-detects examples from package.json scripts
# Usage: pnpm examples:all

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Start mock server in background
echo "🚀 Starting mock server..."
pnpm mock-server > /dev/null 2>&1 &
MOCK_SERVER_PID=$!

# Wait for server to be ready
sleep 2

# Cleanup function
cleanup() {
  echo ""
  echo "🛑 Stopping mock server..."
  kill $MOCK_SERVER_PID 2>/dev/null || true
  exit
}

# Register cleanup on script exit
trap cleanup EXIT INT TERM

# Extract all example:* scripts from package.json and extract the names
examples=()
while IFS= read -r line; do
  # Extract example name from "example:name" format
  example_name=$(echo "$line" | sed 's/.*"example:\([^"]*\)".*/\1/')
  if [ "$example_name" != "$line" ] && [ -n "$example_name" ]; then
    examples+=("$example_name")
  fi
done < <(grep -o '"example:[^"]*"' "$PROJECT_ROOT/package.json" | grep -v '"example"')

if [ ${#examples[@]} -eq 0 ]; then
  echo "❌ No examples found in package.json"
  exit 1
fi

echo "🚀 Running all examples..."
echo "📦 Found ${#examples[@]} examples"
echo ""

total=${#examples[@]}
current=0

for example in "${examples[@]}"; do
  current=$((current + 1))
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Running example [$current/$total]: $example"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  pnpm "example:$example"

  echo ""
  echo "✅ Example '$example' completed"
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ All $total examples completed successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

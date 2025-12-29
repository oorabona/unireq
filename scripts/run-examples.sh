#!/bin/bash
# Run specific examples
# Usage: bash scripts/run-examples.sh http oauth retry
#    Or: pnpm examples:run http oauth retry

set -e

if [ $# -eq 0 ]; then
  echo "Usage: bash scripts/run-examples.sh <example1> [example2] [...]"
  echo ""
  echo "Available examples:"
  echo "  http, oauth, retry, multipart, bulk-upload, ecommerce,"
  echo "  ci-artifacts, email, form, graphql-query, graphql-mutation,"
  echo "  streaming-upload, streaming-download, sse,"
  echo "  interceptors-logging, interceptors-metrics, interceptors-cache,"
  echo "  conditional-etag, conditional-lastmodified, conditional-combined"
  exit 1
fi

total=$#
current=0

for example in "$@"; do
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

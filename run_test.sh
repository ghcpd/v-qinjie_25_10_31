#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f package.json ]; then
  echo "package.json not found in $SCRIPT_DIR" >&2
  exit 1
fi

npm install

npm audit --json > npm-audit-report.json || true
node scan.js --ci --quiet > scan-ci.json

echo "npm-audit-report.json and scan-report.json generated in $SCRIPT_DIR"
echo "Console JSON output saved to scan-ci.json"

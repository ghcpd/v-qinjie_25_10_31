#!/usr/bin/env bash
set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not found in PATH" >&2
  exit 1
fi

npm audit --json > npm-audit-report.json || true
node scan.js --output scan-report.json

echo "Reports generated: npm-audit-report.json, scan-report.json"

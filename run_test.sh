#!/usr/bin/env bash
set -euo pipefail

mkdir -p reports

# npm audit returns non-zero when vulnerabilities are found; capture output but continue
if ! npm audit --json > reports/npm-audit.json; then
  echo "npm audit reported vulnerabilities; see reports/npm-audit.json for details." >&2
fi

node scan.js > reports/security-scan.json

echo "Security scan complete. Reports stored in reports/ directory." 

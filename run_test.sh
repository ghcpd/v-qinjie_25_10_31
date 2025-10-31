#!/usr/bin/env bash
set -euo pipefail

echo "Installing dependencies..." 
npm install --no-audit --no-fund

echo "Running npm audit..." 
npm audit --json > audit-report.json || echo "npm audit completed with non-zero exit code (captured)."

echo "Running custom security scan..." 
node scan.js

echo "Combining reports..." 
node - <<'NODE'
const fs = require('fs');
const combined = {
  timestamp: new Date().toISOString(),
  scan: JSON.parse(fs.readFileSync('scan-report.json','utf8')),
  audit: JSON.parse(fs.readFileSync('audit-report.json','utf8'))
};
fs.writeFileSync('combined-security-report.json', JSON.stringify(combined,null,2));
console.log('combined-security-report.json generated');
NODE

echo "Done." 
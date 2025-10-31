#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js is required. Install Node.js 18 or newer before running this script." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[!] npm is required. It is included with Node.js but was not found in PATH." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

npm install

cat <<'EOF'
Environment setup completed.
Remember to provide secrets via environment variables such as API_KEY, JWT_SECRET, DB_HOST, DB_USER, DB_PASS, and DB_NAME rather than keeping them in source control.
EOF

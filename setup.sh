#!/usr/bin/env bash
set -euo pipefail

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but not installed" >&2
  exit 1
fi

npm install

echo "Setup complete. Run 'npm start' to launch the server." 

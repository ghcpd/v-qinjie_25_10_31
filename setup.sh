#!/usr/bin/env bash
set -euo pipefail
echo "Setting up environment..."
if [ ! -f .env ]; then
  cat > .env <<'EOF'
# Example environment configuration (DO NOT COMMIT REAL SECRETS)
API_KEY=change_me_api_key
JWT_SECRET=change_me_jwt_secret
DB_HOST=localhost
DB_USER=root
DB_PASS=example_password
DB_NAME=users_db
PORT=3000
ALLOWED_ORIGINS=https://example.com
EOF
  echo ".env file created with placeholder secrets. Replace before production use." 
fi
echo "Installing dependencies..."
npm install --no-audit --no-fund
echo "Setup complete." 
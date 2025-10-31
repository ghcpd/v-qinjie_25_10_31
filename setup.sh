#!/bin/bash

set -e

echo "========================================"
echo "Security Audit Environment Setup"
echo "========================================"

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Install dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install

echo ""
echo "✅ Dependencies installed successfully"

# Create .env.example file
echo ""
echo "📝 Creating .env.example file..."
cat > .env.example << 'EOF'
# Database Configuration
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_secure_password
DB_NAME=users_db

# Security Secrets
API_KEY=your_api_key_here
JWT_SECRET=your_jwt_secret_here

# Application Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3001,https://yourdomain.com
EOF

echo "✅ .env.example created"

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo ""
    echo "📝 Creating .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*

# Reports
npm_audit_report.json
scan_report.json
vulnerability_report.json

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
EOF
    echo "✅ .gitignore created"
fi

# Check for MySQL
echo ""
echo "🔍 Checking for MySQL..."
if command -v mysql &> /dev/null; then
    echo "✅ MySQL client detected: $(mysql --version)"
else
    echo "⚠️  MySQL client not found. You may need to install it for database connectivity."
fi

# Create database setup script
echo ""
echo "📝 Creating database setup script..."
cat > setup_database.sql << 'EOF'
-- Create database
CREATE DATABASE IF NOT EXISTS users_db;

USE users_db;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert sample user (password: 'testpass123' hashed with bcrypt)
-- Note: In production, use proper password hashing!
INSERT INTO users (username, password_hash, email) VALUES 
('admin', '$2b$10$rKvFQE3qP7OqZ5H8FvJyNeLYqJy7L8.VqN3jCfq0Xm0ZzR8YqLFjS', 'admin@example.com'),
('testuser', '$2b$10$rKvFQE3qP7OqZ5H8FvJyNeLYqJy7L8.VqN3jCfq0Xm0ZzR8YqLFjS', 'test@example.com')
ON DUPLICATE KEY UPDATE username=username;

-- Grant privileges (adjust as needed for your environment)
-- GRANT ALL PRIVILEGES ON users_db.* TO 'your_db_user'@'localhost';
-- FLUSH PRIVILEGES;

SELECT 'Database setup complete!' as message;
EOF

echo "✅ setup_database.sql created"

echo ""
echo "========================================"
echo "✅ Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and fill in your actual credentials"
echo "2. Set up MySQL database: mysql -u root -p < setup_database.sql"
echo "3. Run security scan: bash run_test.sh"
echo "4. Start application: npm start"
echo ""
echo "To build Docker container:"
echo "  docker build -t security-audit-demo ."
echo "  docker run -p 3000:3000 --env-file .env security-audit-demo"
echo ""

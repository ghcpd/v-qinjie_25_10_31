# Security Vulnerability Remediation Guide

## Executive Summary

This Node.js/Express application contains **8 critical security vulnerabilities** that require immediate attention. The primary issues are:

- **3 Critical**: Hardcoded secrets (API key, JWT secret, database credentials)
- **3 Critical/High**: SQL injection, sensitive data leakage, CORS misconfiguration
- **2 Medium**: Debug mode enabled, dangerous code patterns

**Risk Level**: CRITICAL  
**Immediate Action Required**: Yes

---

## Critical Vulnerabilities (Immediate Fix Required)

### 1. Hardcoded API Key (VULN-001)

**Location**: `app.js:9`

**Current Code**:
```javascript
const API_KEY = "pk_prod_ABCDEF123456";
```

**Fixed Code**:
```javascript
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error('API_KEY environment variable is required');
}
```

**Steps**:
1. Create `.env` file (ensure it's in `.gitignore`)
2. Add: `API_KEY=pk_prod_ABCDEF123456`
3. Install dotenv: `npm install dotenv`
4. At top of `app.js`: `require('dotenv').config();`
5. **CRITICAL**: Rotate the exposed API key immediately through your API provider
6. Remove hardcoded key from code
7. Purge from git history: `git filter-branch --force --index-filter "git rm --cached --ignore-unmatch app.js" --prune-empty --tag-name-filter cat -- --all`

---

### 2. Hardcoded JWT Secret (VULN-002)

**Location**: `app.js:10`

**Current Code**:
```javascript
const JWT_SECRET = "supersecretjwtkey";
```

**Fixed Code**:
```javascript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters');
}
```

**Steps**:
1. Generate strong secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. Add to `.env`: `JWT_SECRET=<generated-secret>`
3. Update code to use `process.env.JWT_SECRET`
4. **CRITICAL**: Invalidate all existing JWT tokens (users will need to re-login)
5. Implement token rotation strategy

---

### 3. Hardcoded Database Credentials (VULN-003)

**Location**: `app.js:11-14`

**Current Code**:
```javascript
const DB_HOST = "localhost";
const DB_USER = "root";
const DB_PASS = "root_password";
const DB_NAME = "users_db";
```

**Fixed Code**:
```javascript
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Security enhancements
  connectTimeout: 10000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
};

// Validate required fields
if (!dbConfig.user || !dbConfig.password || !dbConfig.database) {
  throw new Error('Database credentials must be provided via environment variables');
}

const db = mysql.createConnection(dbConfig);
```

**Steps**:
1. Add to `.env`:
   ```
   DB_HOST=localhost
   DB_USER=app_user
   DB_PASSWORD=<strong-password>
   DB_NAME=users_db
   ```
2. **CRITICAL**: Change database password immediately
3. Create dedicated database user with minimal privileges (not root)
4. Grant only necessary permissions: `GRANT SELECT, INSERT, UPDATE ON users_db.* TO 'app_user'@'localhost';`

---

### 4. SQL Injection Vulnerability (VULN-004)

**Location**: `app.js:30`

**Current Code**:
```javascript
const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
db.query(query, function(err, results) {
  // ...
});
```

**Fixed Code**:
```javascript
const query = "SELECT * FROM users WHERE username = ? AND password = ?";
db.query(query, [username, password], function(err, results) {
  if (err) {
    console.error('Database error:', err);
    return res.status(500).json({ message: "Server error" });
  }
  // ... rest of logic
});
```

**Better Solution with Password Hashing**:
```javascript
const bcrypt = require('bcrypt');

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Input validation
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }
  
  // Parameterized query
  const query = "SELECT id, username, password_hash FROM users WHERE username = ?";
  
  db.query(query, [username], async function(err, results) {
    if (err) {
      console.error('Database error');
      return res.status(500).json({ message: "Server error" });
    }
    
    if (results && results.length > 0) {
      const user = results[0];
      
      // Compare hashed password
      const isValid = await bcrypt.compare(password, user.password_hash);
      
      if (isValid) {
        // Generate JWT token
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
          { userId: user.id, username: user.username },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );
        
        return res.json({ 
          message: "Login successful", 
          token: token,
          userId: user.id
        });
      }
    }
    
    return res.status(401).json({ message: "Invalid credentials" });
  });
});
```

**Steps**:
1. Install bcrypt: `npm install bcrypt jsonwebtoken`
2. Replace string concatenation with parameterized queries
3. Never store passwords in plaintext - use bcrypt hashing
4. Implement proper JWT token generation
5. Add input validation

---

### 5. Sensitive Data Leakage (VULN-005)

**Location**: `app.js:37`

**Current Code**:
```javascript
return res.json({ 
  message: "Login successful", 
  apiKey: API_KEY, 
  jwtSecret: JWT_SECRET 
});
```

**Fixed Code**:
```javascript
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: results[0].id, username: results[0].username },
  JWT_SECRET,
  { expiresIn: '1h', issuer: 'your-app-name' }
);

return res.json({ 
  message: "Login successful", 
  token: token,
  user: {
    id: results[0].id,
    username: results[0].username
  }
});
```

**Rules**:
- ❌ **NEVER** return secrets in API responses
- ❌ **NEVER** return password hashes
- ❌ **NEVER** return internal system details
- ✅ Return only user-specific, non-sensitive data
- ✅ Use JWT tokens for authentication
- ✅ Include only necessary user information

---

## High Severity Vulnerabilities

### 6. Overly Permissive CORS (VULN-006)

**Location**: `app.js:18`

**Current Code**:
```javascript
app.use(cors({ origin: '*' }));
```

**Fixed Code**:
```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3001'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

**Environment Variable**:
```
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

---

## Medium Severity Issues

### 7. Debug Mode Enabled (VULN-007)

**Current Code**:
```javascript
const DEBUG = true;
```

**Fixed Code**:
```javascript
const DEBUG = process.env.NODE_ENV !== 'production';

// Better: Use proper logging library
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Don't log in production console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Usage
app.post('/login', (req, res) => {
  // ...
  if (err) {
    logger.error('Database error', { error: err.message }); // Don't log full error details
    return res.status(500).json({ message: "Server error" });
  }
});
```

---

### 8. Dangerous Code Pattern (VULN-008)

**Current Code**:
```javascript
// const result = eval(code);
```

**Action**: Delete this entire commented section. Never use:
- `eval()`
- `new Function()`
- `vm.runInNewContext()` without proper sandboxing

**If you need to evaluate user code** (not recommended):
```javascript
const { VM } = require('vm2');

const vm = new VM({
  timeout: 1000,
  sandbox: {},
  eval: false,
  wasm: false
});

try {
  const result = vm.run(safeCode);
} catch (err) {
  // Handle error
}
```

---

## Additional Security Enhancements

### 1. Add Input Validation

```javascript
const Joi = require('joi');

const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(8).required()
});

app.post('/login', (req, res) => {
  const { error, value } = loginSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }
  
  // Continue with validated data
  const { username, password } = value;
  // ...
});
```

### 2. Add Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/login', loginLimiter, (req, res) => {
  // ...
});
```

### 3. Add Security Headers

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 4. Improve Error Handling

```javascript
// Never expose internal errors to clients
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { 
    error: err.message, 
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
  });
  
  res.status(500).json({ 
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message 
  });
});
```

### 5. Database Connection Pooling

```javascript
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Use promises
const promisePool = pool.promise();

// Usage
async function loginUser(username, password) {
  const [rows] = await promisePool.query(
    'SELECT id, username, password_hash FROM users WHERE username = ?',
    [username]
  );
  return rows;
}
```

---

## Complete Secure app.js Example

```javascript
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const app = express();

// Middleware
app.use(helmet());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts'
});

// Validation schema
const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(8).required()
});

// Login endpoint
app.post('/login', loginLimiter, async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: 'Invalid input' });
    }

    const { username, password } = value;

    // Query database with parameterized query
    const [rows] = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
```

---

## .env File Template

Create `.env` file (and add to `.gitignore`):

```env
# Database
DB_HOST=localhost
DB_USER=app_user
DB_PASSWORD=<generate-strong-password>
DB_NAME=users_db

# Security
API_KEY=<your-api-key>
JWT_SECRET=<generate-with-crypto.randomBytes(64).toString('hex')>

# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

---

## Dependencies to Install

```bash
npm install dotenv bcrypt jsonwebtoken helmet express-rate-limit joi mysql2 winston
```

---

## Testing Checklist

- [ ] All secrets moved to environment variables
- [ ] `.env` file in `.gitignore`
- [ ] SQL queries use parameterized statements
- [ ] Passwords hashed with bcrypt
- [ ] JWT tokens used for authentication
- [ ] No secrets in API responses
- [ ] CORS restricted to specific origins
- [ ] Rate limiting enabled on login
- [ ] Input validation implemented
- [ ] Security headers configured (helmet)
- [ ] Error handling doesn't leak sensitive info
- [ ] Database credentials rotated
- [ ] Exposed API keys rotated
- [ ] Git history cleaned of secrets

---

## Compliance & Standards

This remediation addresses:
- **OWASP Top 10 2021**: A02 (Crypto Failures), A03 (Injection), A05 (Security Misconfiguration), A07 (Auth Failures)
- **CWE-798**: Hard-coded Credentials
- **CWE-89**: SQL Injection
- **CWE-200**: Information Exposure
- **PCI-DSS**: Requirement 6.5.1, 6.5.3, 8.2.1
- **GDPR**: Security of processing (Article 32)

---

## Emergency Response Checklist

If this code is in production:

1. ✅ **Immediately rotate all exposed credentials**
2. ✅ **Deploy SQL injection fix ASAP**
3. ✅ **Review access logs for suspicious activity**
4. ✅ **Invalidate all existing sessions/tokens**
5. ✅ **Scan git history for exposed secrets**
6. ✅ **Notify security team and stakeholders**
7. ✅ **Perform security audit of database**
8. ✅ **Monitor for unusual API usage**

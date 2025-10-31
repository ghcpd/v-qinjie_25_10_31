// Secure refactored version of the service. Original insecure code preserved in `insecure_app.js` for scanning.
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Security middleware
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false }));

// Configuration via environment variables (never hardcode secrets)
const {
  API_KEY, // Not returned to clients
  JWT_SECRET, // Used for JWT signing (not exposed)
  DB_HOST = 'localhost',
  DB_USER = 'root',
  DB_PASS = '',
  DB_NAME = 'users_db',
  PORT = 3000,
  ALLOWED_ORIGINS = 'https://example.com'
} = process.env;

// Restrictive CORS configuration
const allowed = ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: function(origin, cb) {
    // Allow server-to-server or same-origin with no origin header
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('Origin not allowed by CORS policy'));
  },
  credentials: true
}));

// Database connection (use prepared statements via mysql2)
const db = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  connectionLimit: 5
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  // Parameterized query prevents SQL injection
  const query = 'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1';
  db.query(query, [username], (err, rows) => {
    if (err) {
      console.error('DB error (suppressed details):', err.code);
      return res.status(500).json({ message: 'Server error' });
    }
    if (!rows || rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const user = rows[0];
    const stored = user.password_hash;
    let passwordOk = false;
    try {
      if (stored) {
        // Attempt bcrypt comparison; fallback plain equality ONLY if hash pattern not detected
        const looksHashed = /\$2[aby]\$/.test(stored);
        passwordOk = looksHashed ? bcrypt.compareSync(password, stored) : stored === password;
      }
    } catch (e) {
      return res.status(500).json({ message: 'Auth error' });
    }
    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Do NOT leak secrets. Provide minimal success message.
    return res.json({ message: 'Login successful' });
  });
});

// Removed dynamic eval endpoint entirely; never execute arbitrary code from clients.

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

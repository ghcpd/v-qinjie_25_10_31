// Original insecure application retained for scanning demonstration
const express = require('express');
const mysql = require('mysql');
const cors = require('cors');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Hardcoded secrets (to be detected)
const API_KEY = "pk_prod_ABCDEF123456";
const JWT_SECRET = "supersecretjwtkey";
const DB_HOST = "localhost";
const DB_USER = "root";
const DB_PASS = "root_password";
const DB_NAME = "users_db";
const DEBUG = true;

// Overly permissive CORS
app.use(cors({ origin: '*' }));

const db = mysql.createConnection({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME
});

app.post('/login', (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  // SQL Injection risk via concatenation
  const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "'";
  db.query(query, function(err, results) {
    if (err) {
      if (DEBUG) console.error(err); // Potential debug leakage
      return res.status(500).json({ message: "Server error" });
    }
    if (results && results.length > 0) {
      // Leaks secrets in response
      return res.json({ message: "Login successful", apiKey: API_KEY, jwtSecret: JWT_SECRET });
    } else {
      return res.status(401).json({ message: "Invalid credentials" });
    }
  });
});

// Dynamic code execution example (commented but still detectable)
/*
app.post('/run', (req, res) => {
  const code = req.body.code;
  const result = eval(code); // Dangerous
  res.json({ result });
});
*/

app.listen(3000, () => {
  console.log('Server started on port 3000');
});

module.exports = app;
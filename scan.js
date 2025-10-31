#!/usr/bin/env node

/**
 * Automated Security Scanner for Node.js/Express Applications
 * Detects: hardcoded secrets, SQL injection, eval usage, sensitive data leakage, CORS issues
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  targetFiles: ['app.js', 'server.js', 'index.js'],
  scanPatterns: {
    secrets: [
      { pattern: /(?:API_KEY|APIKEY|api_key)\s*=\s*["']([^"']+)["']/gi, type: 'API Key', severity: 'CRITICAL' },
      { pattern: /(?:JWT_SECRET|jwt_secret|JWT_KEY)\s*=\s*["']([^"']+)["']/gi, type: 'JWT Secret', severity: 'CRITICAL' },
      { pattern: /(?:DB_PASS|DB_PASSWORD|database_password|db_password)\s*=\s*["']([^"']+)["']/gi, type: 'Database Password', severity: 'CRITICAL' },
      { pattern: /(?:DB_USER|database_user|db_user)\s*=\s*["']([^"']+)["']/gi, type: 'Database Username', severity: 'HIGH' },
      { pattern: /(?:SECRET_KEY|secret_key|SECRET)\s*=\s*["']([^"']+)["']/gi, type: 'Secret Key', severity: 'CRITICAL' },
      { pattern: /(?:PASSWORD|password|PASSWD|passwd)\s*=\s*["']([^"']+)["']/gi, type: 'Password', severity: 'CRITICAL' },
      { pattern: /(?:AWS_ACCESS_KEY_ID|aws_access_key)\s*=\s*["']([^"']+)["']/gi, type: 'AWS Access Key', severity: 'CRITICAL' },
      { pattern: /(?:AWS_SECRET_ACCESS_KEY|aws_secret)\s*=\s*["']([^"']+)["']/gi, type: 'AWS Secret Key', severity: 'CRITICAL' },
      { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, type: 'Bearer Token', severity: 'HIGH' },
      { pattern: /sk_live_[A-Za-z0-9]{24,}/gi, type: 'Stripe Secret Key', severity: 'CRITICAL' },
      { pattern: /pk_live_[A-Za-z0-9]{24,}/gi, type: 'Stripe Publishable Key', severity: 'HIGH' },
    ],
    sqlInjection: [
      { pattern: /["']SELECT\s+.*?\+.*?["']/gi, type: 'SQL Concatenation', severity: 'CRITICAL' },
      { pattern: /["']INSERT\s+.*?\+.*?["']/gi, type: 'SQL Concatenation', severity: 'CRITICAL' },
      { pattern: /["']UPDATE\s+.*?\+.*?["']/gi, type: 'SQL Concatenation', severity: 'CRITICAL' },
      { pattern: /["']DELETE\s+.*?\+.*?["']/gi, type: 'SQL Concatenation', severity: 'CRITICAL' },
      { pattern: /query\s*=\s*["'].*?\s*\+\s*\w+/gi, type: 'Query String Concatenation', severity: 'CRITICAL' },
      { pattern: /WHERE\s+\w+\s*=\s*['"]\s*\+/gi, type: 'SQL Injection Vector', severity: 'CRITICAL' },
    ],
    codeExecution: [
      { pattern: /\beval\s*\(/gi, type: 'eval() Usage', severity: 'CRITICAL' },
      { pattern: /new\s+Function\s*\(/gi, type: 'Function Constructor', severity: 'CRITICAL' },
      { pattern: /vm\.runInNewContext/gi, type: 'VM Code Execution', severity: 'HIGH' },
      { pattern: /child_process\.exec\(/gi, type: 'Command Execution', severity: 'HIGH' },
      { pattern: /require\([^)]*req\.|require\([^)]*user/gi, type: 'Dynamic Require', severity: 'HIGH' },
    ],
    sensitiveData: [
      { pattern: /res\.json\(.*?(?:password|secret|key|token|apikey|jwt).*?\)/gi, type: 'Sensitive Data in Response', severity: 'HIGH' },
      { pattern: /console\.log\(.*?(?:password|secret|key|token).*?\)/gi, type: 'Sensitive Data Logging', severity: 'MEDIUM' },
      { pattern: /res\.send\(.*?(?:password|secret|key|token).*?\)/gi, type: 'Sensitive Data in Response', severity: 'HIGH' },
    ],
    cors: [
      { pattern: /cors\(\s*\{\s*origin\s*:\s*['"]?\*['"]?\s*\}\s*\)/gi, type: 'Wildcard CORS', severity: 'HIGH' },
      { pattern: /Access-Control-Allow-Origin.*?\*/gi, type: 'Wildcard CORS Header', severity: 'HIGH' },
    ],
    debug: [
      { pattern: /DEBUG\s*=\s*true/gi, type: 'Debug Mode Enabled', severity: 'MEDIUM' },
      { pattern: /process\.env\.NODE_ENV\s*===\s*['"]development['"]/gi, type: 'Development Mode Check', severity: 'LOW' },
    ],
    crypto: [
      { pattern: /md5\(/gi, type: 'Weak Hash (MD5)', severity: 'HIGH' },
      { pattern: /sha1\(/gi, type: 'Weak Hash (SHA1)', severity: 'MEDIUM' },
      { pattern: /crypto\.createCipher\(/gi, type: 'Deprecated Cipher', severity: 'MEDIUM' },
    ]
  }
};

// Scan results storage
const scanResults = {
  metadata: {
    timestamp: new Date().toISOString(),
    scanner: 'scan.js - Automated Security Scanner',
    version: '1.0.0',
  },
  files_scanned: [],
  vulnerabilities: [],
  summary: {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  }
};

/**
 * Get line number for a match position
 */
function getLineNumber(content, position) {
  return content.substring(0, position).split('\n').length;
}

/**
 * Get code snippet around the match
 */
function getCodeSnippet(content, lineNumber, contextLines = 2) {
  const lines = content.split('\n');
  const start = Math.max(0, lineNumber - contextLines - 1);
  const end = Math.min(lines.length, lineNumber + contextLines);
  return lines.slice(start, end).join('\n');
}

/**
 * Scan a file for security vulnerabilities
 */
function scanFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  console.log(`🔍 Scanning: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  scanResults.files_scanned.push(filePath);

  let vulnerabilityId = scanResults.vulnerabilities.length + 1;

  // Scan for each category
  for (const [category, patterns] of Object.entries(CONFIG.scanPatterns)) {
    for (const patternConfig of patterns) {
      const matches = [...content.matchAll(patternConfig.pattern)];
      
      for (const match of matches) {
        const lineNumber = getLineNumber(content, match.index);
        const snippet = getCodeSnippet(content, lineNumber);

        const vulnerability = {
          id: `SCAN-${String(vulnerabilityId).padStart(3, '0')}`,
          category: category,
          type: patternConfig.type,
          severity: patternConfig.severity,
          file: filePath,
          line: lineNumber,
          match: match[0].substring(0, 100), // Truncate long matches
          code_snippet: snippet,
          description: generateDescription(category, patternConfig.type, match[0])
        };

        scanResults.vulnerabilities.push(vulnerability);
        scanResults.summary.total++;
        scanResults.summary[patternConfig.severity.toLowerCase()]++;
        vulnerabilityId++;

        // Log finding
        const severityEmoji = {
          'CRITICAL': '🔴',
          'HIGH': '🟠',
          'MEDIUM': '🟡',
          'LOW': '🟢'
        };
        console.log(`  ${severityEmoji[patternConfig.severity]} [${patternConfig.severity}] ${patternConfig.type} at line ${lineNumber}`);
      }
    }
  }
}

/**
 * Generate description for vulnerability
 */
function generateDescription(category, type, match) {
  const descriptions = {
    'API Key': 'Hardcoded API key detected in source code. This should be stored in environment variables.',
    'JWT Secret': 'Hardcoded JWT secret found. This allows attackers to forge authentication tokens.',
    'Database Password': 'Database password hardcoded in source. Move to secure environment variables.',
    'Database Username': 'Database username hardcoded in source. Use environment configuration.',
    'SQL Concatenation': 'SQL query built with string concatenation. Vulnerable to SQL injection attacks.',
    'Query String Concatenation': 'Database query using string concatenation with user input. Use parameterized queries.',
    'SQL Injection Vector': 'Potential SQL injection vulnerability detected in WHERE clause.',
    'eval() Usage': 'Use of eval() function detected. This allows arbitrary code execution.',
    'Function Constructor': 'Dynamic Function constructor usage. Can lead to code injection.',
    'VM Code Execution': 'VM context execution detected. Ensure proper sandboxing.',
    'Command Execution': 'Command execution via child_process. Validate and sanitize all inputs.',
    'Dynamic Require': 'Dynamic require() with user input. Can lead to arbitrary module loading.',
    'Sensitive Data in Response': 'Sensitive data (passwords, secrets, keys) being sent in API response.',
    'Sensitive Data Logging': 'Sensitive data being logged to console. Remove from production code.',
    'Wildcard CORS': 'CORS configured with wildcard (*). Restrict to specific trusted origins.',
    'Wildcard CORS Header': 'CORS header set to allow all origins. Security risk for authenticated endpoints.',
    'Debug Mode Enabled': 'Debug mode hardcoded to true. Should be controlled via environment variables.',
    'Weak Hash (MD5)': 'MD5 hashing detected. Use stronger algorithms like SHA-256 or bcrypt.',
    'Weak Hash (SHA1)': 'SHA1 hashing detected. Consider using SHA-256 or bcrypt for passwords.',
    'Deprecated Cipher': 'Deprecated crypto.createCipher() usage. Use crypto.createCipheriv() instead.'
  };

  return descriptions[type] || `${type} detected in code.`;
}

/**
 * Generate remediation recommendations
 */
function generateRemediations() {
  const remediations = [];
  const categories = {};

  // Group by category
  scanResults.vulnerabilities.forEach(vuln => {
    if (!categories[vuln.category]) {
      categories[vuln.category] = [];
    }
    categories[vuln.category].push(vuln);
  });

  // Generate recommendations per category
  for (const [category, vulns] of Object.entries(categories)) {
    if (category === 'secrets') {
      remediations.push({
        category: 'Hardcoded Secrets',
        priority: 'CRITICAL',
        recommendation: 'Move all secrets to environment variables. Use .env files (with .gitignore) or secret management systems.',
        affected_files: [...new Set(vulns.map(v => v.file))],
        count: vulns.length
      });
    } else if (category === 'sqlInjection') {
      remediations.push({
        category: 'SQL Injection',
        priority: 'CRITICAL',
        recommendation: 'Replace string concatenation with parameterized queries or prepared statements.',
        affected_files: [...new Set(vulns.map(v => v.file))],
        count: vulns.length
      });
    } else if (category === 'codeExecution') {
      remediations.push({
        category: 'Code Execution',
        priority: 'CRITICAL',
        recommendation: 'Remove eval() and dynamic code execution. Use safe alternatives or sandboxed environments.',
        affected_files: [...new Set(vulns.map(v => v.file))],
        count: vulns.length
      });
    } else if (category === 'sensitiveData') {
      remediations.push({
        category: 'Sensitive Data Exposure',
        priority: 'HIGH',
        recommendation: 'Never return secrets in API responses. Remove sensitive data from logs.',
        affected_files: [...new Set(vulns.map(v => v.file))],
        count: vulns.length
      });
    } else if (category === 'cors') {
      remediations.push({
        category: 'CORS Misconfiguration',
        priority: 'HIGH',
        recommendation: 'Configure CORS with specific allowed origins. Never use wildcard in production.',
        affected_files: [...new Set(vulns.map(v => v.file))],
        count: vulns.length
      });
    }
  }

  return remediations;
}

/**
 * Main scan function
 */
function main() {
  console.log('========================================');
  console.log('🔒 Security Vulnerability Scanner');
  console.log('========================================\n');

  // Scan target files
  CONFIG.targetFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    scanFile(filePath);
  });

  // Add remediations
  scanResults.remediations = generateRemediations();

  console.log('\n========================================');
  console.log('📊 Scan Summary');
  console.log('========================================');
  console.log(`Files Scanned: ${scanResults.files_scanned.length}`);
  console.log(`Total Vulnerabilities: ${scanResults.summary.total}`);
  console.log(`  🔴 Critical: ${scanResults.summary.critical}`);
  console.log(`  🟠 High: ${scanResults.summary.high}`);
  console.log(`  🟡 Medium: ${scanResults.summary.medium}`);
  console.log(`  🟢 Low: ${scanResults.summary.low}`);

  // Save results
  const outputFile = 'scan_report.json';
  fs.writeFileSync(outputFile, JSON.stringify(scanResults, null, 2));
  console.log(`\n✅ Report saved to: ${outputFile}`);

  // Exit with error code if critical/high vulnerabilities found
  if (scanResults.summary.critical > 0 || scanResults.summary.high > 0) {
    console.log('\n⚠️  CRITICAL or HIGH severity vulnerabilities detected!');
    process.exit(1);
  } else {
    console.log('\n✅ No critical vulnerabilities found.');
    process.exit(0);
  }
}

// Run scanner
if (require.main === module) {
  main();
}

module.exports = { scanFile, scanResults };

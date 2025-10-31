#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
let outputFile = 'scan-results.json';
const outputFlagIndex = process.argv.indexOf('--output');
if (outputFlagIndex !== -1 && process.argv[outputFlagIndex + 1]) {
  outputFile = process.argv[outputFlagIndex + 1];
}

const findings = [];

function recordFinding({ id, type, severity, description, file, line, snippet }) {
  findings.push({
    id,
    type,
    severity,
    description,
    file,
    line,
    snippet: snippet.trim()
  });
}

function shouldSkipDir(entryPath) {
  return entryPath.includes('node_modules') || entryPath.includes('.git');
}

function walkDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entryPath)) {
        walkDir(entryPath);
      }
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      scanFile(entryPath);
    }
  }
}

function scanFile(filePath) {
  const relPath = path.relative(root, filePath).replace(/\\/g, '/');
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1;

    if (/(API_KEY|JWT_SECRET|DB_PASS|DB_PASSWORD|PASSWORD|SECRET|TOKEN)\s*=\s*['"][^'"]+['"]/.test(line)) {
      recordFinding({
        id: 'VULN-001',
        type: 'hardcoded-secret',
        severity: 'high',
        description: 'Possible hardcoded credential detected. Move secrets to environment variables or a secrets manager.',
        file: relPath,
        line: lineNumber,
        snippet: line
      });
    }

    if (/SELECT\s+.*\+.*(username|password|req\.body)/i.test(line) || /WHERE\s+.*['"]\s*\+\s*/i.test(line)) {
      recordFinding({
        id: 'VULN-002',
        type: 'sql-injection',
        severity: 'critical',
        description: 'Potential SQL injection via string concatenation. Use parameterized queries or prepared statements.',
        file: relPath,
        line: lineNumber,
        snippet: line
      });
    }

    if (/cors\s*\(\s*{[^}]*origin\s*:\s*['"]\*/i.test(line)) {
      recordFinding({
        id: 'VULN-003',
        type: 'misconfiguration',
        severity: 'medium',
        description: 'Overly permissive CORS configuration. Restrict allowed origins.',
        file: relPath,
        line: lineNumber,
        snippet: line
      });
    }

    if (/res\.(json|send)\s*\(\s*{[^}]*(apiKey|jwtSecret|password)/i.test(line)) {
      recordFinding({
        id: 'VULN-004',
        type: 'sensitive-data-exposure',
        severity: 'high',
        description: 'Sensitive data is returned in the HTTP response. Remove secrets from responses.',
        file: relPath,
        line: lineNumber,
        snippet: line
      });
    }

    if (/const\s+DEBUG\s*=\s*true/i.test(line)) {
      recordFinding({
        id: 'VULN-005',
        type: 'insecure-configuration',
        severity: 'low',
        description: 'Debug mode enabled in production code. Disable debug logging in production.',
        file: relPath,
        line: lineNumber,
        snippet: line
      });
    }

    if (/eval\s*\(/i.test(line)) {
      recordFinding({
        id: 'VULN-006',
        type: 'dynamic-code-execution',
        severity: 'critical',
        description: 'Dynamic code execution via eval detected. Remove eval usage to prevent remote code execution.',
        file: relPath,
        line: lineNumber,
        snippet: line
      });
    }
  });
}

walkDir(root);

const report = {
  generatedAt: new Date().toISOString(),
  root,
  findings
};

fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

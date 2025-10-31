#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'reports');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (/[.](js|ts|json|env)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function analyzeFile(filePath) {
  const issues = [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  const hardcodedSecretRegex = /(api[_-]?key|secret|token|password|passphrase|db[_-]?(user|pass|password|host|name))/i;
  const stringLiteralRegex = /=\s*["']([A-Za-z0-9_\-]{8,})["']/;
  const sqlConcatRegex = /(SELECT|UPDATE|DELETE|INSERT)[^;]*['"`]\s*\+\s*[a-zA-Z0-9_]+/i;
  const wildcardCorsRegex = /cors\s*\(\s*{[^}]*origin\s*:\s*['"]\*['"]/i;
  const debugFlagRegex = /const\s+debug\s*=\s*true/i;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (hardcodedSecretRegex.test(line) && stringLiteralRegex.test(line)) {
      issues.push({
        id: 'hardcoded-secret',
        type: 'Hardcoded Credential',
        severity: 'high',
        description: `Potential hardcoded secret detected: ${line.trim()}`,
        file: filePath,
        line: lineNumber,
        remediation: 'Move secrets into environment variables or a secrets manager and reference them securely at runtime.'
      });
    }

    if (sqlConcatRegex.test(line)) {
      issues.push({
        id: 'sql-concatenation',
        type: 'SQL Injection',
        severity: 'critical',
        description: 'Possible SQL injection via string concatenation.',
        file: filePath,
        line: lineNumber,
        remediation: 'Use parameterized queries or query builders to avoid concatenating untrusted input.'
      });
    }

    if (wildcardCorsRegex.test(line)) {
      issues.push({
        id: 'permissive-cors',
        type: 'Overly Permissive CORS',
        severity: 'medium',
        description: 'CORS configuration allows all origins.',
        file: filePath,
        line: lineNumber,
        remediation: 'Restrict CORS origin to trusted domains or implement origin whitelisting.'
      });
    }

    if (/res\.(json|send)\s*\(.*(api|secret|password)/i.test(line)) {
      issues.push({
        id: 'sensitive-response',
        type: 'Sensitive Data Exposure',
        severity: 'high',
        description: 'Sensitive data appears to be included in an HTTP response.',
        file: filePath,
        line: lineNumber,
        remediation: 'Remove secrets from responses and limit returned data to minimal necessary information.'
      });
    }

    if (/eval\s*\(/i.test(line)) {
      issues.push({
        id: 'dynamic-eval',
        type: 'Dynamic Code Execution',
        severity: 'critical',
        description: 'Usage of eval detected which enables arbitrary code execution.',
        file: filePath,
        line: lineNumber,
        remediation: 'Avoid eval and leverage safe alternatives such as whitelisting allowed operations or using a sandboxed interpreter.'
      });
    }

    if (debugFlagRegex.test(line)) {
      issues.push({
        id: 'debug-flag',
        type: 'Debug Logging Enabled',
        severity: 'low',
        description: 'Debug flag enabled which may leak sensitive data in logs.',
        file: filePath,
        line: lineNumber,
        remediation: 'Disable debug logging in production or guard it behind environment-specific checks.'
      });
    }
  });

  return issues;
}

function main() {
  const files = walk(ROOT);
  const issues = files.flatMap(analyzeFile);
  const report = {
    generatedAt: new Date().toISOString(),
    root: ROOT,
    issueCount: issues.length,
    issues
  };

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, 'security-scan.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
}

main();

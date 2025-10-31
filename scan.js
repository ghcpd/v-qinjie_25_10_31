/*
 Heuristic security scanner for Node.js/Express apps.
 Scans files for:
  - Hardcoded secrets (API keys, JWT, DB credentials)
  - SQL injection patterns (string concatenation including user inputs)
  - Overly permissive CORS ('origin: *')
  - Debug flags / console logging of errors
  - Dynamic code execution (eval, Function, vm.*)
  - Sensitive data leakage in responses (sending secrets)
 Output: JSON array written to scan-report.json
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TARGET_EXT = ['.js', '.ts'];

const secretRegexes = [
  { id: 'secret.api_key', re: /pk_(test|prod)_[0-9A-Za-z]{8,}/, severity: 'high', desc: 'Possible hardcoded API key' },
  { id: 'secret.jwt', re: /jwt[_-]?secret\s*=\s*['"][A-Za-z0-9_!@#$%^&*.-]{8,}['"]/i, severity: 'high', desc: 'Possible hardcoded JWT secret' },
  { id: 'secret.generic', re: /(API_KEY|JWT_SECRET|DB_PASS|DB_PASSWORD)\s*=\s*['"][^'"\n]{6,}['"]/g, severity: 'high', desc: 'Hardcoded credential or secret variable' }
];

const dynamicExecPatterns = [/\beval\(/, /new Function\(/, /vm\.runIn(New)?Context/];
const permissiveCorsPattern = /origin:\s*['"]\*['"]/;
const sqlConcatPattern = /SELECT[\s\S]*FROM[\s\S]*\+\s*\w+|\w+\s*\+\s*['"][^;]*SELECT/i;
const sensitiveLeakPattern = /(apiKey|jwtSecret|password_hash|DB_PASS)/i;

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const findings = [];

  // Secrets
  secretRegexes.forEach(cfg => {
    let match; const re = new RegExp(cfg.re.source, cfg.re.flags);
    while ((match = re.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split(/\r?\n/).length;
      findings.push({ id: cfg.id, type: 'secret', severity: cfg.severity, description: cfg.desc + ` => ${match[0]}`, file: filePath, line: lineNum, remediation: 'Move to environment variable and remove from source code.' });
      if (!re.global) break;
    }
  });

  // Dynamic execution
  dynamicExecPatterns.forEach(re => {
    lines.forEach((line, idx) => {
      if (re.test(line)) {
        findings.push({ id: 'code.dynamic_exec', type: 'code-execution', severity: 'critical', description: 'Use of dynamic code execution: ' + line.trim(), file: filePath, line: idx + 1, remediation: 'Remove eval/Function/vm usage. Implement whitelist of allowed operations or server-side logic.' });
      }
    });
  });

  // Permissive CORS
  lines.forEach((line, idx) => {
    if (permissiveCorsPattern.test(line)) {
      findings.push({ id: 'config.cors_permissive', type: 'misconfiguration', severity: 'medium', description: 'Overly permissive CORS origin *', file: filePath, line: idx + 1, remediation: 'Restrict origins to known domains. Use a validation function.' });
    }
  });

  // SQL concatenation
  lines.forEach((line, idx) => {
    if (/SELECT.*\+/.test(line) || sqlConcatPattern.test(line)) {
      findings.push({ id: 'injection.sql_concat', type: 'injection', severity: 'high', description: 'Potential SQL injection via string concatenation: ' + line.trim(), file: filePath, line: idx + 1, remediation: 'Use parameterized queries/prepared statements.' });
    }
  });

  // Sensitive leak in responses
  lines.forEach((line, idx) => {
    if (/res\.json\(/.test(line) && sensitiveLeakPattern.test(line)) {
      findings.push({ id: 'leak.sensitive_response', type: 'data-leakage', severity: 'high', description: 'Sensitive data potentially leaked in API response: ' + line.trim(), file: filePath, line: idx + 1, remediation: 'Remove secret fields from responses. Return minimal data.' });
    }
  });

  // Debug logging of raw errors
  lines.forEach((line, idx) => {
    if (/console\.error\(err\)/.test(line)) {
      findings.push({ id: 'logging.debug_leak', type: 'information-exposure', severity: 'low', description: 'Direct logging of error object may expose internals.', file: filePath, line: idx + 1, remediation: 'Log sanitized error codes or messages only.' });
    }
  });

  return findings;
}

function walk(dir) {
  const items = fs.readdirSync(dir);
  let results = [];
  items.forEach(item => {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (!/node_modules|\.git/.test(full)) {
        results = results.concat(walk(full));
      }
    } else {
      if (TARGET_EXT.includes(path.extname(full))) {
        results.push(full);
      }
    }
  });
  return results;
}

const files = walk(ROOT);
let allFindings = [];
files.forEach(f => {
  try { allFindings = allFindings.concat(scanFile(f)); } catch (e) { /* ignore read error */ }
});

fs.writeFileSync(path.join(ROOT, 'scan-report.json'), JSON.stringify(allFindings, null, 2));
console.log(`Scan complete. Findings: ${allFindings.length}`);
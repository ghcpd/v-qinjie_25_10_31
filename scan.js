#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const ignoreDirs = new Set(['node_modules', '.git', '.vscode', 'dist', 'build']);
const outputPath = path.join(projectRoot, 'scan-report.json');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.js', '.ts', '.json', '.env', '.yml', '.yaml'].includes(ext) || entry.name === 'Dockerfile') {
        files.push(fullPath);
      }
    }
  }
}

const files = [];
walk(projectRoot);

const detectors = [
  {
    id: 'secret.hardcoded',
    type: 'secret',
    severity: 'high',
    description: 'Possible hardcoded credential or secret value.',
    test: (line) => /(api[_-]?key|jwt|secret|token|password|db_(?:pass|user|host|name)|client[_-]?secret)\s*[:=]\s*["'`][^"'`]{4,}["'`]/i.test(line)
  },
  {
    id: 'db.credentials',
    type: 'secret',
    severity: 'high',
    description: 'Database connection may be using plaintext credentials.',
    test: (line) => /(createConnection|connect)\s*\(\s*\{[^}]*password\s*:/i.test(line)
  },
  {
    id: 'sql.concatenation',
    type: 'injection',
    severity: 'critical',
    description: 'SQL query appears to concatenate untrusted input.',
    test: (line) => /select\s+.+from/i.test(line) && (/\+/g.test(line) || /`.*\$\{.+\}.*`/.test(line))
  },
  {
    id: 'cors.wildcard',
    type: 'misconfiguration',
    severity: 'medium',
    description: 'CORS configuration allows any origin ("*").',
    test: (line) => /(cors\s*\(\s*\{[^}]*origin\s*:\s*['"]\*['"])/i.test(line)
  },
  {
    id: 'debug.leak',
    type: 'misconfiguration',
    severity: 'medium',
    description: 'Debug logging flag enabled in production code.',
    test: (line) => /debug\s*=?\s*true/i.test(line)
  },
  {
    id: 'response.sensitive',
    type: 'info_leak',
    severity: 'high',
    description: 'API response appears to return sensitive secrets to clients.',
    test: (line) => /(res\.(json|send)\s*\(\s*\{[^}]*(api|jwt|secret|token))/i.test(line)
  },
  {
    id: 'dynamic.eval',
    type: 'dangerous_function',
    severity: 'high',
    description: 'Use of eval/dynamic code execution detected.',
    test: (line) => /\beval\s*\(/i.test(line) || /new\s+Function\s*\(/i.test(line)
  },
  {
    id: 'logging.errors',
    type: 'info_leak',
    severity: 'low',
    description: 'Console logging of raw error objects may leak sensitive information.',
    test: (line) => /console\.(error|log)\s*\(/i.test(line) && /err|error/.test(line)
  }
];

const findings = [];

for (const filePath of files) {
  const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    detectors.forEach((detector) => {
      try {
        if (detector.test(line, lines, idx, filePath)) {
          findings.push({
            id: detector.id,
            type: detector.type,
            severity: detector.severity,
            description: detector.description,
            file: relativePath,
            line: idx + 1,
            evidence: line.trim().slice(0, 200)
          });
        }
      } catch (err) {
        // continue scanning other detectors
      }
    });
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  projectRoot,
  findings
};

fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

const args = process.argv.slice(2);
const ciMode = args.includes('--ci');
const quiet = args.includes('--quiet');

if (!quiet) {
  console.log(`Security scan complete. Findings: ${findings.length}`);
  if (findings.length) {
    findings.slice(0, 20).forEach((finding) => {
      console.log(`- [${finding.severity.toUpperCase()}] ${finding.id} @ ${finding.file}:${finding.line}`);
    });
    if (findings.length > 20) {
      console.log(`  ... ${findings.length - 20} additional findings omitted from console output.`);
    }
    console.log(`Detailed report written to ${outputPath}`);
  }
}

if (ciMode) {
  // Provide machine-readable output as well
  console.log(JSON.stringify(report));
}

process.exit(0);

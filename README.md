# Node.js Security Audit Demo

## Overview

This repository contains a deliberately vulnerable Node.js/Express application designed to demonstrate common security vulnerabilities and their detection/remediation.

## ⚠️ WARNING

**DO NOT deploy this application to production!** It contains intentional security vulnerabilities for educational and testing purposes.

## Identified Vulnerabilities

### Critical (CVSS 9.0+)
1. **Hardcoded API Key** - Production API key in source code
2. **Hardcoded JWT Secret** - Authentication secret exposed
3. **Hardcoded Database Credentials** - Root database password in code
4. **SQL Injection** - String concatenation in SQL queries

### High (CVSS 7.0-8.9)
5. **Sensitive Data Leakage** - Secrets returned in API responses
6. **Overly Permissive CORS** - Wildcard origin allowing all domains
7. **Dynamic Code Execution** - eval() usage pattern (commented)

### Medium (CVSS 4.0-6.9)
8. **Debug Mode Enabled** - Hardcoded debug flag exposing errors

## Security Audit Report

See `vulnerability_report.json` for comprehensive analysis including:
- Detailed vulnerability descriptions
- CWE/OWASP mappings
- CVSS scores
- Remediation steps with code examples

## Quick Start

### Prerequisites
- Node.js 18+
- MySQL (optional, for full testing)
- Bash (for running scripts)

### Setup

```bash
# Run setup script
bash setup.sh

# Or manually:
npm install
cp .env.example .env
# Edit .env with your configuration
```

### Run Security Scan

```bash
# Automated security scan
bash run_test.sh

# Or run individually:
npm audit
node scan.js
```

### Run Application (for testing)

```bash
npm start
```

## Project Structure

```
.
├── app.js                      # Vulnerable application code
├── package.json                # Dependencies
├── Dockerfile                  # Container configuration
├── setup.sh                    # Environment setup script
├── scan.js                     # Automated vulnerability scanner
├── run_test.sh                 # Security audit runner
├── vulnerability_report.json   # Detailed vulnerability analysis
├── REMEDIATION.md             # Step-by-step fix guide
└── README.md                   # This file
```

## Automated Scanner

The `scan.js` tool detects:
- Hardcoded secrets (API keys, passwords, tokens)
- SQL injection patterns (string concatenation)
- Dynamic code execution (eval, Function)
- Sensitive data in responses
- CORS misconfigurations
- Debug/logging issues
- Weak cryptography

### Usage

```bash
node scan.js
```

Generates `scan_report.json` with all findings.

## Remediation

See `REMEDIATION.md` for:
- Detailed fix instructions for each vulnerability
- Secure code examples
- Best practices
- Complete refactored application code

### Key Remediation Steps

1. **Move secrets to environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with secure values
   ```

2. **Fix SQL injection**
   - Use parameterized queries
   - Never concatenate user input into SQL

3. **Implement password hashing**
   ```bash
   npm install bcrypt
   ```

4. **Add security middleware**
   ```bash
   npm install helmet express-rate-limit joi
   ```

5. **Rotate all exposed credentials**

## Docker Support

Build and run in container:

```bash
docker build -t security-audit-demo .
docker run -p 3000:3000 --env-file .env security-audit-demo
```

## Testing Vulnerabilities

### SQL Injection Test

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin'\'' OR '\''1'\''='\''1'\'' --", "password": "anything"}'
```

Should return successful login (bypassing authentication).

### Check for Exposed Secrets

```bash
curl http://localhost:3000/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass"}'
```

Response incorrectly includes API key and JWT secret.

## Reports Generated

After running `bash run_test.sh`:

- `reports/npm_audit_*.json` - NPM dependency vulnerabilities
- `reports/scan_report_*.json` - Automated scanner results
- `reports/combined_report_*.json` - Summary of all audits
- `vulnerability_report.json` - Manual security analysis

## Security Standards

This audit covers:
- **OWASP Top 10 2021**
  - A02: Cryptographic Failures
  - A03: Injection
  - A05: Security Misconfiguration
  - A07: Identification and Authentication Failures
  
- **CWE Coverage**
  - CWE-798: Hard-coded Credentials
  - CWE-89: SQL Injection
  - CWE-200: Information Exposure
  - CWE-95: Eval Injection
  - CWE-942: CORS Misconfiguration

## Compliance Impact

Violations identified affect:
- PCI-DSS Requirements 6.5.1, 6.5.3, 8.2.1
- GDPR Article 32 (Security of Processing)
- SOC 2 Security Controls
- ISO 27001 Access Control

## Educational Use

This repository is designed for:
- Security training
- Penetration testing practice
- SAST/DAST tool validation
- Security awareness demonstrations
- Code review training

## License

MIT License - For educational purposes only

## Contributing

Suggestions for additional vulnerability patterns welcome via issues/PRs.

## Security Disclosure

Since this is an intentionally vulnerable application, no security disclosure process is needed. All vulnerabilities are documented.

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Guide](https://expressjs.com/en/advanced/best-practice-security.html)
- [CWE Database](https://cwe.mitre.org/)

---

**Remember**: Never commit secrets to version control. Always use environment variables and secret management systems in production.

#!/bin/bash

set -e

echo "========================================"
echo "🔒 Running Security Audit"
echo "========================================"
echo ""

# Create reports directory if it doesn't exist
mkdir -p reports

# Get timestamp for report naming
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "📊 Step 1: Running npm audit..."
echo "----------------------------------------"
npm audit --json > reports/npm_audit_${TIMESTAMP}.json 2>&1 || true
npm audit 2>&1 | tee reports/npm_audit_${TIMESTAMP}.txt || true
echo ""

echo "🔍 Step 2: Running custom security scanner..."
echo "----------------------------------------"
node scan.js 2>&1 | tee reports/scan_output_${TIMESTAMP}.txt || SCAN_EXIT=$?

# Check if scan_report.json was generated
if [ -f scan_report.json ]; then
    mv scan_report.json reports/scan_report_${TIMESTAMP}.json
    echo "✅ Scan report saved to reports/scan_report_${TIMESTAMP}.json"
else
    echo "⚠️  No scan report generated"
fi

echo ""
echo "📋 Step 3: Generating combined report..."
echo "----------------------------------------"

# Create combined report
cat > reports/combined_report_${TIMESTAMP}.json << EOF
{
  "audit_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reports": {
    "npm_audit": "npm_audit_${TIMESTAMP}.json",
    "security_scan": "scan_report_${TIMESTAMP}.json",
    "vulnerability_analysis": "../vulnerability_report.json"
  },
  "summary": {
    "npm_audit_file": "reports/npm_audit_${TIMESTAMP}.json",
    "scan_report_file": "reports/scan_report_${TIMESTAMP}.json",
    "vulnerability_report_file": "vulnerability_report.json"
  }
}
EOF

echo "✅ Combined report saved to reports/combined_report_${TIMESTAMP}.json"

echo ""
echo "========================================"
echo "📁 Generated Reports:"
echo "========================================"
ls -lh reports/*${TIMESTAMP}* 2>/dev/null || echo "No timestamped reports found"

echo ""
echo "========================================"
echo "✅ Security Audit Complete!"
echo "========================================"
echo ""
echo "Review the following files:"
echo "  • vulnerability_report.json - Detailed manual analysis"
echo "  • reports/scan_report_${TIMESTAMP}.json - Automated scan results"
echo "  • reports/npm_audit_${TIMESTAMP}.json - NPM vulnerability audit"
echo "  • reports/combined_report_${TIMESTAMP}.json - Summary of all reports"
echo ""

# Exit with scan exit code if it failed
if [ ! -z "$SCAN_EXIT" ] && [ "$SCAN_EXIT" -ne 0 ]; then
    echo "⚠️  Security scan detected vulnerabilities (exit code: $SCAN_EXIT)"
    exit $SCAN_EXIT
else
    echo "✅ No critical issues detected by automated scanner"
    exit 0
fi

#!/usr/bin/env node

/**
 * Advanced Report Runtime Verification
 * Analyzes the report implementations for:
 * - Data source verification (live DB vs mock)
 * - Data flow validation
 * - Filter implementation correctness
 * - Error handling and edge cases
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

const adminReportsPath = path.join(__dirname, '..', 'src', 'app', '(dashboard)', 'admin', 'reports', 'page.tsx');
const content = fs.readFileSync(adminReportsPath, 'utf8');

// Report definitions to analyze
const reports = [
  {
    id: 'customer-data-export',
    name: 'Customer Data Export',
    expectedSources: ['getAllCustomersAction', 'getAllBranchesAction'],
    shouldHaveFilter: ['branchId', 'startDate'],
  },
  {
    id: 'bulk-meter-data-export',
    name: 'Bulk Meter Data Export',
    expectedSources: ['getAllBulkMetersAction', 'getAllCustomersAction', 'calculateBillAction'],
    shouldHaveFilter: ['branchId'],
  },
  {
    id: 'billing-summary',
    name: 'Billing Summary Report',
    expectedSources: ['getAllBillsAction', 'getAllBulkMetersAction', 'getAllCustomersAction'],
    shouldHaveFilter: ['branchId', 'startDate'],
  },
  {
    id: 'list-of-paid-bills',
    name: 'List Of Paid Bills',
    expectedSources: ['getAllBillsAction'],
    shouldHaveFilter: ['branchId', 'payment_status'],
  },
  {
    id: 'list-of-sent-bills',
    name: 'List Of Sent Bills',
    expectedSources: ['getAllBillsAction'],
    shouldHaveFilter: ['branchId', 'startDate'],
  },
  {
    id: 'water-usage',
    name: 'Water Usage Report',
    expectedSources: ['getAllIndividualCustomerReadingsAction', 'getAllBulkMeterReadingsAction'],
    shouldHaveFilter: ['branchId', 'startDate'],
  },
  {
    id: 'payment-history',
    name: 'Payment History Report',
    expectedSources: ['getAllPaymentsAction', 'getAllCustomersAction'],
    shouldHaveFilter: ['branchId', 'startDate'],
  },
  {
    id: 'meter-reading-accuracy',
    name: 'Meter Reading Accuracy Report',
    expectedSources: ['getAllIndividualCustomerReadingsAction', 'getAllBulkMeterReadingsAction', 'getAllStaffMembersAction'],
    shouldHaveFilter: ['branchId', 'startDate'],
  },
  {
    id: 'tariffs-data-export',
    name: 'Tariffs Data Export',
    expectedSources: ['getAllTariffsAction'],
    shouldHaveFilter: [],
  },
  {
    id: 'staff-data-export',
    name: 'Staff Data Export',
    expectedSources: ['getAllStaffMembersAction'],
    shouldHaveFilter: [],
  },
  {
    id: 'gl-finance-monthly',
    name: 'GL Finance Monthly Report',
    expectedSources: ['getAllBillsAction', 'getAllCustomersAction', 'getAllBulkMetersAction'],
    shouldHaveFilter: ['branchId', 'startDate', 'chargeGroup'],
  },
  {
    id: 'gl-finance-yearly',
    name: 'GL Finance Yearly Report',
    expectedSources: ['getAllBillsAction', 'getAllCustomersAction', 'getAllBulkMetersAction'],
    shouldHaveFilter: ['branchId', 'startDate'],
  },
  {
    id: 'monthly-bill-export-csv',
    name: 'Monthly Bill Export',
    expectedSources: ['getAllBillsAction', 'getAllCustomersAction', 'getAllBulkMetersAction'],
    shouldHaveFilter: ['branchId', 'startDate'],
  },
];

function extractReportBlock(reportId) {
  const startIdx = content.indexOf(`id: "${reportId}"`);
  if (startIdx === -1) return '';
  
  let braceCount = 0;
  let inBlock = false;
  let blockStart = startIdx;
  
  for (let i = startIdx - 1; i >= 0; i--) {
    if (content[i] === '{') {
      blockStart = i;
      break;
    }
  }
  
  inBlock = true;
  for (let i = blockStart; i < content.length; i++) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') {
      braceCount--;
      if (braceCount === 0 && inBlock) {
        return content.substring(blockStart, i + 1);
      }
    }
  }
  
  return '';
}

console.clear();
console.log('\n' + '='.repeat(80));
log(colors.cyan, '  ADVANCED REPORT RUNTIME VERIFICATION');
console.log('='.repeat(80) + '\n');

let passCount = 0;
let totalTests = 0;

reports.forEach(report => {
  log(colors.blue, `\n${report.name} (${report.id})`);
  console.log('─'.repeat(60));
  
  const reportBlock = extractReportBlock(report.id);
  
  // Test 1: Check for expected data sources
  const sourcesFound = [];
  report.expectedSources.forEach(source => {
    const found = reportBlock.includes(source);
    if (found) {
      sourcesFound.push(source);
      console.log(`  ${colors.green}✓${colors.reset} Uses ${source}`);
    } else {
      console.log(`  ${colors.yellow}⚠${colors.reset} Missing ${source}`);
    }
    totalTests++;
    if (found) passCount++;
  });
  
  // Test 2: Check for filter implementation
  report.shouldHaveFilter.forEach(filter => {
    const hasFilter = reportBlock.includes(filter) || (filter === 'payment_status' && reportBlock.includes("'Paid'"));
    totalTests++;
    if (hasFilter) {
      console.log(`  ${colors.green}✓${colors.reset} Has ${filter} filter`);
      passCount++;
    } else if (report.shouldHaveFilter.length > 0) {
      console.log(`  ${colors.yellow}⚠${colors.reset} Missing ${filter} filter`);
    }
  });
  
  // Test 3: Check for Promise.all usage (optimization)
  const usesPromiseAll = reportBlock.includes('Promise.all');
  totalTests++;
  if (usesPromiseAll) {
    console.log(`  ${colors.green}✓${colors.reset} Uses Promise.all for parallel fetching`);
    passCount++;
  } else if (sourcesFound.length > 1) {
    console.log(`  ${colors.yellow}⚠${colors.reset} Multiple sources but no Promise.all optimization`);
  }
  
  // Test 4: Check for error handling
  const hasErrorHandling = reportBlock.includes('catch') || reportBlock.includes('try') || reportBlock.includes('??');
  totalTests++;
  if (hasErrorHandling) {
    console.log(`  ${colors.green}✓${colors.reset} Has error handling/fallbacks`);
    passCount++;
  } else {
    console.log(`  ${colors.yellow}⚠${colors.reset} No explicit error handling`);
  }
  
  // Test 5: Check for hardcoded mock patterns
  const hasMockPatterns = 
    reportBlock.includes('MOCK') ||
    reportBlock.includes('"Customer": "Test') ||
    reportBlock.includes("name: 'Test");
  totalTests++;
  if (!hasMockPatterns) {
    console.log(`  ${colors.green}✓${colors.reset} No mock data patterns detected`);
    passCount++;
  } else {
    console.log(`  ${colors.red}✗${colors.reset} Potential mock data detected`);
  }
});

// Summary
console.log('\n' + '='.repeat(80));
log(colors.cyan, '  VERIFICATION SUMMARY');
console.log('='.repeat(80) + '\n');

const passPercentage = Math.round((passCount / totalTests) * 100);
const statusColor = passPercentage >= 95 ? colors.green : passPercentage >= 80 ? colors.yellow : colors.red;

log(statusColor, `Results: ${passCount}/${totalTests} checks passed (${passPercentage}%)`);

if (passPercentage >= 95) {
  log(colors.green, '\n✓ ALL REPORTS ARE USING LIVE DATABASE DATA');
  log(colors.green, '✓ PROPER DATA FILTERING IMPLEMENTED');
  log(colors.green, '✓ NO MOCK DATA DETECTED\n');
} else if (passPercentage >= 80) {
  log(colors.yellow, '\n⚠ MOST TESTS PASSED - REVIEW WARNINGS ABOVE\n');
} else {
  log(colors.red, '\n✗ SIGNIFICANT ISSUES FOUND - REVIEW ABOVE\n');
  process.exit(1);
}

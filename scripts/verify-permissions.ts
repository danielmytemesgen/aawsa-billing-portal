import fs from 'fs';
import path from 'path';
import { PERMISSIONS } from '../src/lib/constants/auth';

/**
 * CI/CD RBAC Verification Script
 * Validates that all permission checks in src/ are canonical and no forbidden role strings exist.
 */

const VALID_PERMISSIONS = new Set<string>([
  ...Object.values(PERMISSIONS),
  '*',
  'all',
]);

// Known backward-compatible or dynamic permission aliases allowed during gradual migration
const ALLOWED_ALIASES = new Set<string>([
  'admin',
  'bill_view_branch',
  'bill_view_all',
  'billing_view',
  'reports_view_branch',
  'reports_view_all',
  'staff_view',
  'staff_view_branch',
  'staff_view_all',
  'meter_readings_view_branch',
  'meter_readings_view_all',
  'meter_readings_create',
  'customers_create',
  'bulk_meters_create',
  'bulk_meters_view_all',
  'bulk_meters_view_branch',
  'customers_view_all',
  'customers_view_branch',
  'routes_view_assigned',
  'data_entry_access',
  'dashboard_view_all',
  'dashboard_view_branch',
]);

const FORBIDDEN_ROLE_PATTERNS = [
  /role\s*===\s*['"](?:admin|super admin|head office)['"]/i,
  /role\.includes\(['"](?:admin|head office)['"]\)/i,
];

interface Violation {
  file: string;
  line: number;
  type: string;
  detail: string;
}

const violations: Violation[] = [];
let filesScanned = 0;

function scanDirectory(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== 'dist') {
        scanDirectory(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
        continue; // Skip unit test fixtures
      }

      filesScanned++;
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const lineNum = index + 1;

        // 1. Check for raw string permission calls: hasPermission('...')
        const hasPermMatches = line.matchAll(/hasPermission\(['"]([^'"]+)['"]\)/g);
        for (const match of hasPermMatches) {
          const perm = match[1];
          if (!VALID_PERMISSIONS.has(perm) && !ALLOWED_ALIASES.has(perm)) {
            violations.push({
              file: path.relative(process.cwd(), fullPath),
              line: lineNum,
              type: 'UNKNOWN_PERMISSION',
              detail: `hasPermission('${perm}') is not defined in PERMISSIONS constants`,
            });
          }
        }

        // 2. Check for forbidden role string bypass patterns
        for (const pattern of FORBIDDEN_ROLE_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              file: path.relative(process.cwd(), fullPath),
              line: lineNum,
              type: 'FORBIDDEN_ROLE_CHECK',
              detail: `Hardcoded role check detected: ${line.trim()}`,
            });
          }
        }
      });
    }
  }
}

console.log('🔍 Running RBAC & Permissions Integrity Audit...');
scanDirectory(path.join(process.cwd(), 'src'));

console.log(`📁 Scanned ${filesScanned} TypeScript files.`);

if (violations.length === 0) {
  console.log('✅ RBAC Audit Passed! Zero permission violations detected.');
  process.exit(0);
} else {
  console.error(`❌ Found ${violations.length} RBAC violation(s):`);
  violations.forEach((v) => {
    console.error(`  - [${v.type}] ${v.file}:${v.line} -> ${v.detail}`);
  });
  process.exit(1);
}


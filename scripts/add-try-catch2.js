const fs = require('fs');
const path = './src/lib/data-store.ts';
let content = fs.readFileSync(path, 'utf8');

const functionsToWrap = [
  'fetchAllTariffs',
  'fetchAllCustomers',
  'fetchAllBulkMeters',
  'fetchAllStaffMembers',
  'fetchAllBills',
  'fetchAllIndividualCustomerReadings',
  'fetchAllBulkMeterReadings',
  'fetchAllPayments',
  'fetchAllReportLogs',
  'fetchAllRoles',
  'fetchAllPermissions',
  'fetchAllRolePermissions',
  'fetchAllKnowledgeBaseArticles'
];

for (const fn of functionsToWrap) {
  // Regex to match the function body up to the last return statement
  const regex = new RegExp(`(async function \\b${fn}\\b\\(.*?\\)\\s*\\{)([\\s\\S]*?)(\\n\\s+return \\w+;\\n\\})`);
  
  content = content.replace(regex, (match, def, body, end) => {
    if (body.includes('try {')) return match;
    const indentedBody = body.split('\n').map(line => '  ' + line).join('\n');
    return `${def}\n  try {${indentedBody}\n  } catch (err) {\n    console.warn("DataStore: ${fn} failed (offline?)", err);\n  }${end}`;
  });
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done script 2!');

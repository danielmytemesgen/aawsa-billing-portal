const fs = require('fs');
const path = './src/lib/data-store.ts';
let content = fs.readFileSync(path, 'utf8');

// Function names to wrap:
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
  // We look for: async function <name>(...) { \n const { data, error } = await ...;
  const regex = new RegExp(`(async function ${fn}\\(.*?\\)\\s*\\{)([\\s\\S]*?)(  ${fn.replace('fetchAll', '').toLowerCase()}Fetched = true;\\n  return)`);
  
  content = content.replace(regex, (match, def, body, end) => {
    // Only wrap if not already wrapped
    if (body.includes('try {')) return match;

    // We indent the body by 2 spaces
    const indentedBody = body.split('\n').map(line => '  ' + line).join('\n');
    return `${def}\n  try {${indentedBody}  } catch (err) {\n    console.warn("DataStore: ${fn} failed (offline?)", err);\n  }\n${end}`;
  });
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');

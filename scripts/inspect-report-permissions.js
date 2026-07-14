const fs = require('fs');
const path = require('path');
const files = [
  'src/app/(dashboard)/staff/reports/page.tsx',
  'src/app/(dashboard)/admin/reports/page.tsx',
];
for (const relativePath of files) {
  const filePath = path.resolve(relativePath);
  const text = fs.readFileSync(filePath, 'utf8');
  const marker = relativePath.includes('/staff/') ? 'const availableStaffReports' : 'const availableReports';
  const start = text.indexOf(marker);
  const arrStart = text.indexOf('[', start);
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let escaped = false;
  let arrEnd = -1;
  for (let i = arrStart; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) { arrEnd = i; break; }
    }
  }
  if (arrStart === -1 || arrEnd === -1) {
    console.error('failed to find array bounds in', relativePath);
    continue;
  }
  const arrayText = text.slice(arrStart + 1, arrEnd);
  const objects = [];
  let objDepth = 0;
  let objStart = -1;
  inString = false;
  stringChar = '';
  escaped = false;
  for (let i = 0; i < arrayText.length; i++) {
    const ch = arrayText[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; continue; }
    if (ch === '{') {
      if (objDepth === 0) objStart = i;
      objDepth++;
    } else if (ch === '}') {
      objDepth--;
      if (objDepth === 0 && objStart !== -1) {
        objects.push(arrayText.slice(objStart, i + 1));
        objStart = -1;
      }
    }
  }
  console.log(`${relativePath}: ${objects.length} objects`);
  objects.forEach((obj, idx) => {
    const idMatch = obj.match(/id:\s*(['"])(.*?)\1/);
    const id = idMatch ? idMatch[2] : `#${idx}`;
    const hasPermission = /requiredPermission\s*:/m.test(obj);
    console.log(`  ${id}: ${hasPermission ? 'OK' : 'MISSING'}`);
  });
}

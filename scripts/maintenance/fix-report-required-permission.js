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
  const markerIdx = text.indexOf(marker);
  if (markerIdx === -1) {
    console.error('marker not found', marker, 'in', relativePath);
    continue;
  }
  const arrayStart = text.indexOf('[', markerIdx);
  if (arrayStart === -1) {
    console.error('array start not found in', relativePath);
    continue;
  }
  let depth = 0;
  let arrayEnd = -1;
  let inString = false;
  let stringChar = '';
  let escaped = false;
  for (let i = arrayStart; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '[') {
      depth += 1;
    } else if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        arrayEnd = i;
        break;
      }
    }
  }
  if (arrayEnd === -1) {
    console.error('array end not found in', relativePath);
    continue;
  }
  const arrayBody = text.slice(arrayStart + 1, arrayEnd);

  const objectRanges = [];
  let objDepth = 0;
  let objStart = -1;
  inString = false;
  stringChar = '';
  escaped = false;
  for (let i = 0; i < arrayBody.length; i++) {
    const ch = arrayBody[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === '{') {
      if (objDepth === 0) {
        objStart = i;
      }
      objDepth += 1;
    } else if (ch === '}') {
      objDepth -= 1;
      if (objDepth === 0 && objStart !== -1) {
        objectRanges.push([objStart, i]);
        objStart = -1;
      }
    }
  }

  let newBody = arrayBody;
  let offset = 0;
  let inserted = 0;

  objectRanges.forEach(([start, end]) => {
    const region = newBody.slice(start + offset, end + 1 + offset);
    if (/requiredPermission\s*:\s*/.test(region)) {
      return;
    }
    const descMatch = region.match(/(^|\n)(\s*)description\s*:\s*(['"`])([\s\S]*?)\3\s*,\s*\n/);
    if (!descMatch) {
      return;
    }
    const insertPos = start + offset + descMatch.index + descMatch[0].length;
    const indent = descMatch[2] || '';
    const insertText = `${indent}requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,\n`;
    newBody = newBody.slice(0, insertPos) + insertText + newBody.slice(insertPos);
    offset += insertText.length;
    inserted += 1;
  });

  const result = text.slice(0, arrayStart + 1) + newBody + text.slice(arrayEnd);
  fs.writeFileSync(filePath, result, 'utf8');
  console.log(`patched ${relativePath}: inserted ${inserted} requiredPermission fields`);
}

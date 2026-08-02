const fs = require('fs');
const path = require('path');
const files = [
  'src/app/(dashboard)/staff/reports/page.tsx',
  'src/app/(dashboard)/admin/reports/page.tsx',
];

for (const file of files) {
  const filepath = path.resolve(file);
  const text = fs.readFileSync(filepath, 'utf8');
  const marker = file.includes('staff') ? 'const availableStaffReports' : 'const availableReports';
  const start = text.indexOf(marker);
  if (start === -1) {
    console.error('marker not found in', file);
    continue;
  }
  const arrStart = text.indexOf('[', start);
  if (arrStart === -1) {
    console.error('array start not found in', file);
    continue;
  }
  let depth = 0;
  let arrEnd = -1;
  for (let i = arrStart; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') {
      depth--;
      if (depth === 0) {
        arrEnd = i;
        break;
      }
    }
  }
  if (arrEnd === -1) {
    console.error('array end not found in', file);
    continue;
  }
  const before = text.slice(0, arrStart + 1);
  const body = text.slice(arrStart + 1, arrEnd);
  const after = text.slice(arrEnd);
  const lines = body.split(/\r?\n/);

  const newLines = [];
  let braceDepth = 0;
  let inObject = false;
  let objectDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const open = (line.match(/{/g) || []).length;
    const close = (line.match(/}/g) || []).length;
    const newLine = line;

    if (inObject) {
      newLines.push(newLine);
    } else {
      newLines.push(newLine);
    }

    braceDepth += open - close;

    const trimmed = line.trim();
    if (!inObject && trimmed === '{' && braceDepth === 1) {
      inObject = true;
      objectDepth = 1;
    }
    if (inObject && braceDepth === 1 && trimmed.startsWith('description:')) {
      const nextLineIndex = i + 1;
      const nextLine = lines[nextLineIndex] || '';
      if (!nextLine.trim().startsWith('requiredPermission:')) {
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '';
        newLines.push(`${indent}requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,`);
      }
    }
    if (inObject && braceDepth === 0) {
      inObject = false;
    }
  }

  const result = before + newLines.join('\n') + after;
  fs.writeFileSync(filepath, result, 'utf8');
  console.log(`patched ${file}`);
}

const fs = require('fs');
const files = [
  'src/app/(dashboard)/staff/reports/page.tsx',
  'src/app/(dashboard)/admin/reports/page.tsx',
];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const marker = file.includes('staff') ? 'const availableStaffReports' : 'const availableReports';
  const start = text.indexOf(marker);
  if (start === -1) {
    console.error('marker not found in', file);
    continue;
  }
  const equalIndex = text.indexOf('=', start);
  const arrStart = equalIndex === -1 ? -1 : text.indexOf('[', equalIndex);
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
  let newLines = [];
  let objDepth = 0;
  let inObject = false;
  let objLines = [];

  const flushObject = () => {
    if (!objLines.length) return;
    const hasPermission = objLines.some(line => line.trim().startsWith('requiredPermission:'));
    if (!hasPermission) {
      const output = [];
      for (let i = 0; i < objLines.length; i++) {
        const line = objLines[i];
        output.push(line);
        if (line.trim().startsWith('description:')) {
          const indent = line.match(/^(\s*)/)[1] || '';
          output.push(`${indent}requiredPermission: PERMISSIONS.REPORTS_GENERATE_BRANCH,`);
        }
      }
      newLines.push(...output);
    } else {
      newLines.push(...objLines);
    }
    objLines = [];
  };

  for (const line of lines) {
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    if (!inObject && line.trim().startsWith('{') && objDepth === 0) {
      inObject = true;
      objLines.push(line);
    } else if (inObject) {
      objLines.push(line);
    } else {
      newLines.push(line);
    }
    objDepth += openBraces - closeBraces;
    if (inObject && objDepth === 0) {
      flushObject();
      inObject = false;
    }
  }
  if (objLines.length) flushObject();

  const result = before + newLines.join('\n') + after;
  fs.writeFileSync(file, result, 'utf8');
  console.log(`patched ${file}`);
}

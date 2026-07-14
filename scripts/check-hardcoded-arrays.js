#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const allowedExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const excludedDirs = new Set(['node_modules', '.git', '.next', 'out', 'dist', 'build']);

const results = [];

function walkDirectory(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (excludedDirs.has(entry.name)) continue;
    const resolvedPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walkDirectory(resolvedPath);
      continue;
    }

    if (!allowedExtensions.has(path.extname(entry.name))) continue;
    scanFile(resolvedPath);
  }
}

function scanFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);

  function hasIgnoreComment(node) {
    const comments = ts.getLeadingCommentRanges(fileContent, node.pos) || [];
    return comments.some(range => fileContent.slice(range.pos, range.end).includes('hardcoded-array-ignore'));
  }

  function isStringLiteralElement(node) {
    return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  }

  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      const elements = node.initializer.elements;
      if (elements.length > 1 && elements.every(isStringLiteralElement) && !hasIgnoreComment(node)) {
        const name = node.name.getText(sourceFile);
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        results.push({ filePath, name, line: line + 1, count: elements.length });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

walkDirectory(projectRoot);

if (results.length === 0) {
  console.log('No hardcoded string arrays detected.');
  process.exit(0);
}

console.log('Hardcoded string arrays detected:');
for (const result of results) {
  console.log(`- ${path.relative(projectRoot, result.filePath)}:${result.line}  ${result.name} (${result.count} items)`);
}
console.log('\nTo ignore a specific array, add a leading comment containing "hardcoded-array-ignore".');
process.exit(1);

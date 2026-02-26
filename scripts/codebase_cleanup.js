const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Files to ignore (Next.js specific + configuration)
const IGNORED_PATTERNS = [
    'node_modules',
    '.next',
    '.git',
    'next-env.d.ts',
    'next.config',
    'tailwind.config',
    'postcss.config',
    'eslint',
    'check_schema.js',
    'diagnostic', // diagnostic scripts
    'scripts', // Scripts folder itself
    'public',
];

// Entry points that are implicitly used
const ENTRY_POINTS_REGEX = [
    /app\\.*\\page\.(tsx|jsx|js|ts)$/,
    /app\\.*\\layout\.(tsx|jsx|js|ts)$/,
    /app\\.*\\loading\.(tsx|jsx|js|ts)$/,
    /app\\.*\\error\.(tsx|jsx|js|ts)$/,
    /app\\.*\\not-found\.(tsx|jsx|js|ts)$/,
    /app\\.*\\route\.(tsx|jsx|js|ts)$/,
    /app\\.*\\template\.(tsx|jsx|js|ts)$/,
    /app\\.*\\default\.(tsx|jsx|js|ts)$/,
    /middleware\.(ts|js)$/,
    /ai\\dev\.ts$/, // Genkit dev
];

function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (IGNORED_PATTERNS.some(pattern => filePath.includes(pattern))) {
            return;
        }

        if (stat.isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            if (EXTENSIONS.includes(path.extname(file))) {
                fileList.push(filePath);
            }
        }
    });

    return fileList;
}

function extractImports(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const importRegex = /import\s+.*?\s+from\s+['"](.*?)['"];?|export\s+.*?\s+from\s+['"](.*?)['"];?|require\(['"](.*?)['"]\)|import\(['"](.*?)['"]\)/g;

    const imports = [];
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1] || match[2] || match[3] || match[4]);
    }
    return imports;
}

function resolvePath(importPath, currentFile) {
    if (importPath.startsWith('.')) {
        return path.resolve(path.dirname(currentFile), importPath);
    } else if (importPath.startsWith('@/')) {
        return path.join(SRC_DIR, importPath.substring(2));
    }
    // We ignore node_modules imports (non-relative, non-alias)
    return null;
}

function resolveFile(basePath) {
    if (!basePath) return null;

    // Try exact match
    if (fs.existsSync(basePath) && !fs.statSync(basePath).isDirectory()) return basePath;

    // Try with extensions
    for (const ext of EXTENSIONS) {
        if (fs.existsSync(basePath + ext)) return basePath + ext;
    }

    // Try index files
    for (const ext of EXTENSIONS) {
        const indexPath = path.join(basePath, 'index' + ext);
        if (fs.existsSync(indexPath)) return indexPath;
    }

    return null;
}

function findUnusedFiles() {
    const allFiles = getAllFiles(SRC_DIR);
    const usedFiles = new Set();

    // Mark entry points as used
    allFiles.forEach(file => {
        // Normalize path separators for regex check
        const normalizedPath = file; // path.join uses OS separator, regex above matches windows style \\, adjust if needed

        // Check if it matches any entry point regex
        // Note: Regex above uses \\ for backslash (Windows). If on Linux, it might fail. 
        // Best to normalize to forward slashes for regex checking.
        const forwardSlashPath = file.split(path.sep).join('/');

        // Adjust regex for forward slashes
        const isEntryPoint = [
            /app\/.*\/page\.(tsx|jsx|js|ts)$/,
            /app\/.*\/layout\.(tsx|jsx|js|ts)$/,
            /app\/.*\/loading\.(tsx|jsx|js|ts)$/,
            /app\/.*\/error\.(tsx|jsx|js|ts)$/,
            /app\/.*\/not-found\.(tsx|jsx|js|ts)$/,
            /app\/.*\/route\.(tsx|jsx|js|ts)$/,
            /app\/.*\/template\.(tsx|jsx|js|ts)$/,
            /app\/.*\/default\.(tsx|jsx|js|ts)$/,
            /middleware\.(ts|js)$/,
            /ai\/dev\.ts$/,
        ].some(regex => regex.test(forwardSlashPath));

        if (isEntryPoint) {
            usedFiles.add(file);
        }
    });

    // Now build the graph
    // We need to iterate until stability because if A imports B, and B is an entry point, A is not necessarily used.
    // Wait, usage direction is A imports B. So if A is used, B is used.
    // Entry points are roots.
    // So we start with Entry Points and Traverse downwards.

    const visited = new Set();
    const queue = [...usedFiles]; // Start with entry points

    // Also include files in 'components' that might be dynamically imported or used in MDX (if any)
    // For now, let's stick to strict import graph from entry points.

    while (queue.length > 0) {
        const currentFile = queue.shift();
        if (visited.has(currentFile)) continue;
        visited.add(currentFile);
        usedFiles.add(currentFile);

        try {
            const imports = extractImports(currentFile);
            imports.forEach(imp => {
                const resolvedPath = resolvePath(imp, currentFile);
                if (resolvedPath) {
                    const actualFile = resolveFile(resolvedPath);
                    if (actualFile && !visited.has(actualFile)) {
                        // Validate it is within SRC or allowed dirs
                        if (actualFile.startsWith(SRC_DIR) || actualFile.includes(PROJECT_ROOT)) {
                            queue.push(actualFile);
                        }
                    }
                }
            });
        } catch (e) {
            console.error(`Error parsing ${currentFile}:`, e.message);
        }
    }

    // Identify unused
    const unused = allFiles.filter(f => !usedFiles.has(f));
    return unused;
}

function findDuplicates() {
    const allFiles = getAllFiles(SRC_DIR);
    const contentMap = new Map();
    const duplicates = [];

    allFiles.forEach(file => {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            // Normalize content: remove whitespace, generic headers
            const normalized = content.replace(/\s+/g, '');
            if (normalized.length < 50) return; // Skip tiny files

            if (contentMap.has(normalized)) {
                duplicates.push({
                    original: contentMap.get(normalized),
                    duplicate: file
                });
            } else {
                contentMap.set(normalized, file);
            }
        } catch (e) {
            // ignore
        }
    });

    return duplicates;
}

console.log('--- Scanning for Unused Files ---');
const unused = findUnusedFiles();
if (unused.length === 0) {
    console.log('No visually unused files found (traceable from entry points).');
} else {
    console.log(`Found ${unused.length} potentially unused files:`);
    unused.forEach(f => console.log(f));
}

console.log('\n--- Scanning for Exact Duplicates ---');
const duplicates = findDuplicates();
if (duplicates.length === 0) {
    console.log('No exact duplicates found.');
} else {
    console.log(`Found ${duplicates.length} duplicate pairs:`);
    duplicates.forEach(d => console.log(`${d.duplicate} is same as ${d.original}`));
}

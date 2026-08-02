const { execSync } = require('child_process');
const fs = require('fs');

if (process.env.CI === 'true' || process.env.NODE_ENV === 'production') {
  console.log('Skipping husky installation in CI or production environment.');
  process.exit(0);
}

const gitDir = '.git';
if (!fs.existsSync(gitDir)) {
  console.log('Skipping husky installation: .git directory not found.');
  process.exit(0);
}

try {
  console.log('Installing husky...');
  execSync('npx husky', { stdio: 'inherit' });
} catch (error) {
  console.error('Failed to install husky:', error.message);
  // Don't fail the build even if husky installation fails
  process.exit(0);
}

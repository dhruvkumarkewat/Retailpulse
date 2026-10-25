const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outputDir = path.join(rootDir, '.vercel', 'output');
const staticDir = path.join(outputDir, 'static');

console.log('Preparing Vercel Build Output API v3...');

// Ensure .vercel/output and .vercel/output/static exist
fs.mkdirSync(staticDir, { recursive: true });

// Copy all files from dist to .vercel/output/static
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(distDir)) {
  copyDir(distDir, staticDir);
  console.log('Copied dist/ contents into .vercel/output/static/');
} else {
  console.error('Warning: dist/ directory not found to copy.');
}

// Write .vercel/output/config.json
const config = {
  version: 3,
  routes: [
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html' }
  ]
};

fs.writeFileSync(
  path.join(outputDir, 'config.json'),
  JSON.stringify(config, null, 2)
);
console.log('Created .vercel/output/config.json (Build Output API v3).');

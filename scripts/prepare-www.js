const fs = require('fs');
const path = require('path');

const root = process.cwd();
const out = path.join(root, 'www');
const files = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}
copyDir(path.join(root, 'icons'), path.join(out, 'icons'));
copyDir(path.join(root, 'vendor'), path.join(out, 'vendor'));
console.log('www preparado para Android:', out);

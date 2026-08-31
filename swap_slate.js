const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.next') {
        walk(dirPath, callback);
      }
    } else {
      if (f.endsWith('.tsx') || f.endsWith('.ts')) {
        callback(path.join(dir, f));
      }
    }
  });
}

walk('./apps/web/app', (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  let original = content;
  content = content.replace(/slate-950/g, 'TEMP_SLATE_950');
  content = content.replace(/slate-900/g, 'slate-950');
  content = content.replace(/TEMP_SLATE_950/g, 'slate-900');
  
  if (original !== content) {
    fs.writeFileSync(filepath, content);
  }
});

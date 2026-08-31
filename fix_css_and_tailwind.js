const fs = require('fs');

// 1. Swap globals.css back to what I had when I made it lighter
let css = fs.readFileSync('apps/web/app/globals.css', 'utf8');
css = css.replace('--bg-primary: #020617;', '--bg-primary: #0f172a;');
css = css.replace('--bg-secondary: #0f172a;', '--bg-secondary: #020617;');
css = css.replace('--bg-card: rgba(15, 23, 42, 0.92);', '--bg-card: rgba(2, 6, 23, 0.92);');
fs.writeFileSync('apps/web/app/globals.css', css);

// 2. Undo the tailwind swap (so 950 is 950 and 900 is 900)
const path = require('path');
function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      if (f !== 'node_modules' && f !== '.next') walk(dirPath, callback);
    } else {
      if (f.endsWith('.tsx') || f.endsWith('.ts')) callback(path.join(dir, f));
    }
  });
}

walk('./apps/web/app', (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  let original = content;
  // Undo the swap by swapping again
  content = content.replace(/slate-950/g, 'TEMP_SLATE_950');
  content = content.replace(/slate-900/g, 'slate-950');
  content = content.replace(/TEMP_SLATE_950/g, 'slate-900');
  
  if (original !== content) {
    fs.writeFileSync(filepath, content);
  }
});


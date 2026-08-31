const fs = require('fs');
const path = './apps/web/app/globals.css';
let css = fs.readFileSync(path, 'utf8');

// The original values:
// --bg-primary: #020617;
// --bg-secondary: #0f172a;
// --bg-card: rgba(15, 23, 42, 0.92);

css = css.replace('--bg-primary: #020617;', '--bg-primary: #0f172a;');
css = css.replace('--bg-secondary: #0f172a;', '--bg-secondary: #020617;');
css = css.replace('--bg-card: rgba(15, 23, 42, 0.92);', '--bg-card: rgba(2, 6, 23, 0.92);');

fs.writeFileSync(path, css);

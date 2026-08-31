const fs = require('fs');

function replaceFile(path, from, to) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.split(from).join(to);
  fs.writeFileSync(path, content);
}

// In HomePrimaryCard.tsx, the outer section is bg-slate-900/90. Make it bg-slate-950/90.
replaceFile('apps/web/app/components/HomePrimaryCard.tsx', 'bg-slate-900/90', 'bg-slate-950/90');
// Inner items are currently bg-slate-900/60. Make them bg-slate-900/60 (leave them, or make them slate-950 as well). Let's make them slate-900 so they pop against the slate-950 card.

// In page.tsx, the outer section is bg-slate-900/80. Make it bg-slate-950/80.
replaceFile('apps/web/app/page.tsx', 'bg-slate-900/80', 'bg-slate-950/80');

// AppShell uses bg-slate-900 for sidebar/footer? 
// Let's check AppShell:
let appShell = fs.readFileSync('apps/web/app/components/AppShell.tsx', 'utf8');
// footer is bg-slate-900/90, let's make it bg-slate-950/90
appShell = appShell.replace('bg-slate-900/90', 'bg-slate-950/90');
fs.writeFileSync('apps/web/app/components/AppShell.tsx', appShell);


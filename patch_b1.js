const fs = require('fs');
let page = fs.readFileSync('apps/web/app/blackbook/page.tsx', 'utf8');

// The original UI starts at:
//   return (
//     <>
//       <ErrorBoundary sectionName="Blackbook content">
//       <div className="flex flex-col min-h-screen bg-slate-50 overflow-hidden">
// and ends somewhere.
// But wait! We also have the SearchBar and RuleBuilderSheet!
// They are rendered right before the main div.

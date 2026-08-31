const fs = require('fs');
const path = './apps/web/app/blackbook/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// import Suspense if not present
if (!code.includes('import { Suspense }')) {
  code = code.replace(
    'import { FormEvent, useEffect, useMemo, useState } from "react";',
    'import { FormEvent, useEffect, useMemo, useState, Suspense } from "react";'
  );
}

// rename default export
code = code.replace(
  'export default function BlackbookPage() {',
  'function BlackbookPageContent() {'
);

// add the wrapper at the end
code += `\nexport default function BlackbookPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Blackbook...</div>}>
      <BlackbookPageContent />
    </Suspense>
  );
}
`;

fs.writeFileSync(path, code);

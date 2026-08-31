const fs = require('fs');

const original = fs.readFileSync('apps/web/app/blackbook/prototype/VariantB.tsx', 'utf8');

const createVariant = (name, newBg) => {
  // Replace the component name
  let content = original.replace(/function VariantB/g, `function ${name}`);
  
  // Replace only the main container's background color.
  // The original string is: className="flex flex-col min-h-screen bg-slate-900 text-slate-300 p-8"
  content = content.replace(
    /className="flex flex-col min-h-screen bg-slate-900/g,
    `className="flex flex-col min-h-screen ${newBg}`
  );
  
  fs.writeFileSync(`apps/web/app/blackbook/prototype/${name}.tsx`, content);
}

// B1: Slate 800
createVariant('VariantB1', 'bg-slate-800');

// B2: Zinc 800
createVariant('VariantB2', 'bg-zinc-800');

// B3: Gray 800
createVariant('VariantB3', 'bg-gray-800');


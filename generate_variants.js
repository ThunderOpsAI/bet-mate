const fs = require('fs');

const original = fs.readFileSync('apps/web/app/blackbook/prototype/VariantB.tsx', 'utf8');

const createVariant = (name, replacements) => {
  let content = original.replace(/VariantB/g, name);
  for (const [search, replace] of replacements) {
    content = content.split(search).join(replace);
  }
  fs.writeFileSync(`apps/web/app/blackbook/prototype/${name}.tsx`, content);
}

// B1: Slate 800 Base
createVariant('VariantB1', [
  ['bg-slate-900', 'bg-slate-800'],
  ['bg-slate-950', 'bg-slate-900'],
  ['border-slate-800', 'border-slate-700'],
  ['border-slate-700', 'border-slate-600'],
  ['bg-slate-800', 'bg-slate-700'],
  ['hover:bg-slate-900/50', 'hover:bg-slate-800/50'],
  ['text-slate-300', 'text-slate-200'],
  ['text-slate-400', 'text-slate-300'],
  ['text-slate-500', 'text-slate-400'],
  ['text-slate-600', 'text-slate-500'],
]);

// B2: Zinc 800 Base
createVariant('VariantB2', [
  ['slate', 'zinc'],
  ['bg-zinc-900', 'bg-zinc-800'],
  ['bg-zinc-950', 'bg-zinc-900'],
  ['border-zinc-800', 'border-zinc-700'],
  ['border-zinc-700', 'border-zinc-600'],
  ['bg-zinc-800', 'bg-zinc-700'],
  ['hover:bg-zinc-900/50', 'hover:bg-zinc-800/50'],
  ['text-zinc-300', 'text-zinc-200'],
  ['text-zinc-400', 'text-zinc-300'],
  ['text-zinc-500', 'text-zinc-400'],
  ['text-zinc-600', 'text-zinc-500'],
]);

// B3: Slate 700 Base
createVariant('VariantB3', [
  ['bg-slate-900', 'bg-slate-700'],
  ['bg-slate-950', 'bg-slate-800'],
  ['border-slate-800', 'border-slate-600'],
  ['border-slate-700', 'border-slate-500'],
  ['bg-slate-800', 'bg-slate-600'],
  ['hover:bg-slate-900/50', 'hover:bg-slate-700/50'],
  ['text-slate-300', 'text-slate-100'],
  ['text-slate-400', 'text-slate-200'],
  ['text-slate-500', 'text-slate-300'],
  ['text-slate-600', 'text-slate-400'],
]);

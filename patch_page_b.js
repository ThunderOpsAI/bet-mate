const fs = require('fs');
const path = './apps/web/app/blackbook/page.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace imports
code = code.replace(/import \{ VariantA \} from "\.\/prototype\/VariantA";\nimport \{ VariantB \} from "\.\/prototype\/VariantB";\nimport \{ VariantC \} from "\.\/prototype\/VariantC";/g, 
  'import { VariantB1 } from "./prototype/VariantB1";\nimport { VariantB2 } from "./prototype/VariantB2";\nimport { VariantB3 } from "./prototype/VariantB3";'
);

// Update variants array
const oldVariants = 'variants={["A", "B", "C", "Original"]}';
const newVariants = 'variants={["B1", "B2", "B3", "Original"]}';
code = code.split(oldVariants).join(newVariants);

// Update render logic
code = code.replace('const variant = searchParams?.get("variant") || "A";', 'const variant = searchParams?.get("variant") || "B1";');

const oldRender = `
  if (variant === "A") return <><VariantA {...viewProps} /><PrototypeSwitcher variants={["A", "B", "C", "Original"]} current={variant} /></>;
  if (variant === "B") return <><VariantB {...viewProps} /><PrototypeSwitcher variants={["A", "B", "C", "Original"]} current={variant} /></>;
  if (variant === "C") return <><VariantC {...viewProps} /><PrototypeSwitcher variants={["A", "B", "C", "Original"]} current={variant} /></>;
`;
const newRender = `
  if (variant === "B1") return <><VariantB1 {...viewProps} /><PrototypeSwitcher variants={["B1", "B2", "B3", "Original"]} current={variant} /></>;
  if (variant === "B2") return <><VariantB2 {...viewProps} /><PrototypeSwitcher variants={["B1", "B2", "B3", "Original"]} current={variant} /></>;
  if (variant === "B3") return <><VariantB3 {...viewProps} /><PrototypeSwitcher variants={["B1", "B2", "B3", "Original"]} current={variant} /></>;
`;

code = code.split(oldRender).join(newRender);

fs.writeFileSync(path, code);

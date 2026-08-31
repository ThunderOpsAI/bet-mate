const fs = require('fs');
const path = './apps/web/app/blackbook/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/if \(variant === "A"\) return <><VariantA \{\.\.\.viewProps\} \/><PrototypeSwitcher variants=\{\["B1", "B2", "B3", "Original"\]\} current=\{variant\} \/><\/>;/g, 'if (variant === "B1") return <><VariantB1 {...viewProps} /><PrototypeSwitcher variants={["B1", "B2", "B3", "Original"]} current={variant} /></>;');
code = code.replace(/if \(variant === "B"\) return <><VariantB \{\.\.\.viewProps\} \/><PrototypeSwitcher variants=\{\["B1", "B2", "B3", "Original"\]\} current=\{variant\} \/><\/>;/g, 'if (variant === "B2") return <><VariantB2 {...viewProps} /><PrototypeSwitcher variants={["B1", "B2", "B3", "Original"]} current={variant} /></>;');
code = code.replace(/if \(variant === "C"\) return <><VariantC \{\.\.\.viewProps\} \/><PrototypeSwitcher variants=\{\["B1", "B2", "B3", "Original"\]\} current=\{variant\} \/><\/>;/g, 'if (variant === "B3") return <><VariantB3 {...viewProps} /><PrototypeSwitcher variants={["B1", "B2", "B3", "Original"]} current={variant} /></>;');

fs.writeFileSync(path, code);

const fs = require('fs');
const path = './apps/web/app/blackbook/page.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  `import { ErrorBoundary }`, 
  `import { useSearchParams } from "next/navigation";\nimport { ErrorBoundary }`
);

if (!code.includes('useSearchParams')) {
   code = code.replace(
     `import ErrorBoundary`, 
     `import { useSearchParams } from "next/navigation";\nimport { PrototypeSwitcher } from "../components/PrototypeSwitcher";\nimport { VariantA } from "./prototype/VariantA";\nimport { VariantB } from "./prototype/VariantB";\nimport { VariantC } from "./prototype/VariantC";\nimport { BlackbookViewProps } from "./prototype/SharedProps";\nimport ErrorBoundary`
   );
}

code = code.replace(
  `export default function BlackbookPage() {`,
  `export default function BlackbookPage() {\n  const searchParams = useSearchParams();\n  const variant = searchParams?.get("variant") || "A";`
);

const propsCode = `
  const viewProps: BlackbookViewProps = {
    activeTab, setActiveTab,
    isSearchOpen, setIsSearchOpen,
    showComboBuilder, setShowComboBuilder,
    searchEntity, setSearchEntity,
    isRuleBuilderOpen, setIsRuleBuilderOpen,
    fetchConfigs,
    runningTodayConfigs, activeAlertsConfigs, awaitingNextRaceConfigs, dailyRunners, dailyRunnersLoading,
    removeConfig, deleteCombination,
    comboDraft, setComboDraft, saveCombination, savingCombo
  };

  if (variant === "A") return <><VariantA {...viewProps} /><PrototypeSwitcher variants={["A", "B", "C", "Original"]} current={variant} /></>;
  if (variant === "B") return <><VariantB {...viewProps} /><PrototypeSwitcher variants={["A", "B", "C", "Original"]} current={variant} /></>;
  if (variant === "C") return <><VariantC {...viewProps} /><PrototypeSwitcher variants={["A", "B", "C", "Original"]} current={variant} /></>;

  return (
    <>
      <ErrorBoundary sectionName="Blackbook content">
`;

code = code.replace(`return (\n    <ErrorBoundary sectionName="Blackbook content">`, propsCode);
code = code.replace(`</ErrorBoundary>\n  );\n}`, `</ErrorBoundary>\n      <PrototypeSwitcher variants={["A", "B", "C", "Original"]} current={variant} />\n    </>\n  );\n}`);

fs.writeFileSync(path, code);

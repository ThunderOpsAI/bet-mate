const fs = require('fs');

let page = fs.readFileSync('apps/web/app/blackbook/page.tsx', 'utf8');

// The new UI structure we want to inject.
const newUI = `
      <div className="flex flex-col min-h-screen bg-transparent text-slate-300 p-8">
        <div className="flex justify-between items-end mb-8 border-b border-slate-800/60 pb-4">
           <div>
              <h1 className="text-3xl font-light text-white flex items-center gap-3"><BookOpen size={28} className="text-cyan-400"/> Blackbook Terminal</h1>
           </div>
           <div className="flex gap-3">
              <button onClick={() => setIsSearchOpen(true)} className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-white rounded text-sm transition-colors border border-slate-800"><Search size={14} className="inline mr-2"/> Lookup</button>
              <button onClick={() => setShowComboBuilder(true)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm transition-colors"><Plus size={14} className="inline mr-2"/> New Monitor</button>
           </div>
        </div>

        <div className="flex gap-6 mb-6">
          <button onClick={() => setActiveTab("list")} className={\`text-sm font-medium pb-2 border-b-2 transition-colors \${activeTab === "list" ? "border-cyan-400 text-white" : "border-transparent text-slate-500 hover:text-slate-300"}\`}>Monitors</button>
          <button onClick={() => setActiveTab("explore")} className={\`text-sm font-medium pb-2 border-b-2 transition-colors \${activeTab === "explore" ? "border-cyan-400 text-white" : "border-transparent text-slate-500 hover:text-slate-300"}\`}>Market Scanner</button>
        </div>

        {activeTab === "list" ? (
          <div className="space-y-8">
            <div>
               <h2 className="text-xs font-mono text-cyan-400 mb-3 uppercase tracking-widest">Running Today [{runningTodayConfigs.length}]</h2>
               <div className="bg-slate-950 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                     <thead className="bg-slate-950/80 text-slate-500 font-mono text-xs uppercase border-b border-slate-800/60">
                        <tr><th className="px-4 py-4">Entity</th><th className="px-4 py-4">Type</th><th className="px-4 py-4 text-right">Actions</th></tr>
                     </thead>
                     <tbody>
                        {runningTodayConfigs.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center italic text-slate-600">No data</td></tr>}
                        {runningTodayConfigs.map(c => (
                           <tr key={c.runner} className="border-t border-slate-800/40 hover:bg-slate-900/40 transition-colors">
                              <td className="px-4 py-4 font-medium text-white">{c.runner}</td>
                              <td className="px-4 py-4 text-emerald-400"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block mr-2 animate-pulse"></span>Live Today</td>
                              <td className="px-4 py-4 text-right"><button onClick={() => removeConfig(c.runner)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16}/></button></td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
            <div>
               <h2 className="text-xs font-mono text-cyan-400 mb-3 uppercase tracking-widest">Active Alerts [{activeAlertsConfigs.length}]</h2>
               <div className="bg-slate-950 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                     <thead className="bg-slate-950/80 text-slate-500 font-mono text-xs uppercase border-b border-slate-800/60">
                        <tr><th className="px-4 py-4">Entity / Combination</th><th className="px-4 py-4">Ruleset</th><th className="px-4 py-4 text-right">Actions</th></tr>
                     </thead>
                     <tbody>
                        {activeAlertsConfigs.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center italic text-slate-600">No data</td></tr>}
                        {activeAlertsConfigs.map(c => (
                           <tr key={c.id} className="border-t border-slate-800/40 hover:bg-slate-900/40 transition-colors">
                              <td className="px-4 py-4 font-medium text-white">{c.targetName}</td>
                              <td className="px-4 py-4 text-slate-400">{c.combinationType.replace("_", " + ")}</td>
                              <td className="px-4 py-4 text-right"><button onClick={() => deleteCombination(c.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16}/></button></td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950 p-6 rounded-2xl shadow-xl border border-slate-800/80">
             <ExploreTab onAddToBlackbook={(e) => { setSearchEntity({ id: e.name, name: e.name, type: e.type as any }); setIsRuleBuilderOpen(true); }} />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
`;

// Find where `return (` starts for BlackbookPageContent.
// We know it starts at `return (` and we need to replace EVERYTHING after it, EXCEPT the `<BlackbookSearchBar>` and `<BlackbookRuleBuilderSheet>` part.

// Let's just find the `return (` that is for BlackbookPageContent.
// It's the one right after `const viewProps: BlackbookViewProps = {`
const viewPropsIdx = page.indexOf('const viewProps: BlackbookViewProps = {');
const returnIdx = page.indexOf('return (', viewPropsIdx);

if (returnIdx === -1) {
  console.log("Could not find return statement");
  process.exit(1);
}

// The UI should keep the SearchBar and RuleBuilderSheet, and then append newUI.
const topPart = page.slice(0, returnIdx);

// The Modal part from the original return:
const modals = `  return (
    <>
      <BlackbookSearchBar 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onSelect={(item) => {
          const typeMap: Record<string, "horse" | "jockey" | "trainer" | "combination"> = {
            RUNNER: "horse",
            JOCKEY: "jockey",
            TRAINER: "trainer",
            COMBINATION: "combination",
            horse: "horse",
            jockey: "jockey",
            trainer: "trainer"
          };
          setSearchEntity({
            id: item.id,
            name: item.name,
            type: typeMap[item.category || item.type] || "horse",
            jockeyName: item.jockeyName,
            trainerName: item.trainerName,
            horseName: item.horseName,
          });
          setIsRuleBuilderOpen(true);
          setIsSearchOpen(false);
        }}
      />
      <BlackbookRuleBuilderSheet 
        isOpen={isRuleBuilderOpen} 
        onClose={() => setIsRuleBuilderOpen(false)} 
        entity={searchEntity} 
        onSave={() => void fetchConfigs()} 
      />

      <ErrorBoundary sectionName="Blackbook content">
`;

// End part (export default function BlackbookPage...)
const endIdx = page.indexOf('export default function BlackbookPage() {');
if (endIdx === -1) {
  console.log("Could not find BlackbookPage export");
  process.exit(1);
}
const bottomPart = '\n' + page.slice(endIdx);

const finalPage = topPart + modals + newUI + bottomPart;

// Remove imports for the prototypes
let cleanPage = finalPage.replace(/import \{ PrototypeSwitcher \} from "\.\.\/components\/PrototypeSwitcher";\n/g, '');
cleanPage = cleanPage.replace(/import \{ VariantB1 \} from "\.\/prototype\/VariantB1";\n/g, '');
cleanPage = cleanPage.replace(/import \{ VariantB2 \} from "\.\/prototype\/VariantB2";\n/g, '');
cleanPage = cleanPage.replace(/import \{ VariantB3 \} from "\.\/prototype\/VariantB3";\n/g, '');
cleanPage = cleanPage.replace(/import \{ BlackbookViewProps \} from "\.\/prototype\/SharedProps";\n/g, '');

// Also remove `const viewProps ...` logic since we don't need it anymore.
// The `const viewProps` declaration is right before `returnIdx`.
// We can just regex it out.
cleanPage = cleanPage.replace(/const viewProps: BlackbookViewProps = \{[\s\S]*?\};\n/g, '');
cleanPage = cleanPage.replace(/const variant = searchParams\?\.get\("variant"\) \|\| "B1";/g, '');

fs.writeFileSync('apps/web/app/blackbook/page.tsx', cleanPage);


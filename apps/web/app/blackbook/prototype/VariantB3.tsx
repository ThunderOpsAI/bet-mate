import { BookOpen, Search, Plus, Trash2, Clock, Calendar, Activity, Award, User } from "lucide-react";
import { BlackbookViewProps } from "./SharedProps";
import { ExploreTab } from "../../components/ExploreTab";

export function VariantB3(props: BlackbookViewProps) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-800 text-slate-300 p-8">
      <div className="flex justify-between items-end mb-8 border-b border-slate-800 pb-4">
         <div>
            <h1 className="text-3xl font-light text-white flex items-center gap-3"><BookOpen size={28} className="text-cyan-400"/> Blackbook Terminal</h1>
         </div>
         <div className="flex gap-3">
            <button onClick={() => props.setIsSearchOpen(true)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm transition-colors border border-slate-700"><Search size={14} className="inline mr-2"/> Lookup</button>
            <button onClick={() => props.setShowComboBuilder(true)} className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-sm transition-colors"><Plus size={14} className="inline mr-2"/> New Monitor</button>
         </div>
      </div>

      <div className="flex gap-6 mb-6">
        <button onClick={() => props.setActiveTab("list")} className={`text-sm font-medium pb-2 border-b-2 transition-colors ${props.activeTab === "list" ? "border-cyan-400 text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}>Monitors</button>
        <button onClick={() => props.setActiveTab("explore")} className={`text-sm font-medium pb-2 border-b-2 transition-colors ${props.activeTab === "explore" ? "border-cyan-400 text-white" : "border-transparent text-slate-500 hover:text-slate-300"}`}>Market Scanner</button>
      </div>

      {props.activeTab === "list" ? (
        <div className="space-y-8">
          <div>
             <h2 className="text-xs font-mono text-cyan-400 mb-3 uppercase tracking-widest">Running Today [{props.runningTodayConfigs.length}]</h2>
             <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-900 text-slate-500 font-mono text-xs uppercase">
                      <tr><th className="px-4 py-3">Entity</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Actions</th></tr>
                   </thead>
                   <tbody>
                      {props.runningTodayConfigs.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-center italic text-slate-600">No data</td></tr>}
                      {props.runningTodayConfigs.map(c => (
                         <tr key={c.runner} className="border-t border-slate-800 hover:bg-slate-900/50">
                            <td className="px-4 py-3 font-medium text-white">{c.runner}</td>
                            <td className="px-4 py-3 text-emerald-400"><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block mr-2 animate-pulse"></span>Live Today</td>
                            <td className="px-4 py-3 text-right"><button onClick={() => props.removeConfig(c.runner)} className="text-slate-500 hover:text-red-400"><Trash2 size={14}/></button></td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
          <div>
             <h2 className="text-xs font-mono text-cyan-400 mb-3 uppercase tracking-widest">Active Alerts [{props.activeAlertsConfigs.length}]</h2>
             <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-900 text-slate-500 font-mono text-xs uppercase">
                      <tr><th className="px-4 py-3">Entity / Combination</th><th className="px-4 py-3">Ruleset</th><th className="px-4 py-3 text-right">Actions</th></tr>
                   </thead>
                   <tbody>
                      {props.activeAlertsConfigs.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-center italic text-slate-600">No data</td></tr>}
                      {props.activeAlertsConfigs.map(c => (
                         <tr key={c.id} className="border-t border-slate-800 hover:bg-slate-900/50">
                            <td className="px-4 py-3 font-medium text-white">{c.targetName}</td>
                            <td className="px-4 py-3 text-slate-400">{c.combinationType.replace("_", " + ")}</td>
                            <td className="px-4 py-3 text-right"><button onClick={() => props.deleteCombination(c.id)} className="text-slate-500 hover:text-red-400"><Trash2 size={14}/></button></td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950 p-6 rounded-lg border border-slate-800">
           <ExploreTab onAddToBlackbook={(e) => { props.setSearchEntity({ id: e.name, name: e.name, type: e.type as any }); props.setIsRuleBuilderOpen(true); }} />
        </div>
      )}
    </div>
  );
}

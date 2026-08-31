import { BookOpen, Search, Plus, Trash2, Clock, Calendar, Activity, Award, User, CheckCircle2 } from "lucide-react";
import { BlackbookViewProps } from "./SharedProps";
import { ExploreTab } from "../../components/ExploreTab";

export function VariantA(props: BlackbookViewProps) {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 p-6 space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-cyan-100 p-3 rounded-xl text-cyan-700"><BookOpen size={32} /></div>
          <div>
            <h1 className="text-2xl font-bold m-0 text-slate-900">Blackbook Engine</h1>
            <p className="text-slate-500 text-sm mt-1">High-ROI combinatorial partnership watchlists.</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
           <button onClick={() => props.setIsSearchOpen(true)} className="flex gap-2 items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors">
              <Search size={16} /> Search Entities
           </button>
           <button onClick={() => props.setShowComboBuilder(true)} className="flex gap-2 items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm">
              <Plus size={16} /> New Entry
           </button>
        </div>
      </div>
      
      <div className="flex gap-4 bg-white p-2 rounded-xl border border-slate-200 w-max shadow-sm">
        <button onClick={() => props.setActiveTab("list")} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${props.activeTab === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>Dashboard</button>
        <button onClick={() => props.setActiveTab("explore")} className={`px-6 py-2 rounded-lg font-bold text-sm transition-colors ${props.activeTab === "explore" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>Explore Markets</button>
      </div>

      {props.activeTab === "list" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="space-y-4">
              <h2 className="text-sm font-black uppercase text-slate-500 tracking-wider flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Running Today ({props.runningTodayConfigs.length})</h2>
              {props.runningTodayConfigs.length === 0 ? <p className="text-sm text-slate-400 italic">No runners scheduled.</p> : props.runningTodayConfigs.map(c => (
                 <div key={c.runner} className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400"></div>
                    <div className="flex justify-between items-start">
                       <h3 className="font-bold text-slate-900">{c.runner}</h3>
                       <button onClick={() => props.removeConfig(c.runner)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                    </div>
                 </div>
              ))}
           </div>
           
           <div className="space-y-4">
              <h2 className="text-sm font-black uppercase text-slate-500 tracking-wider">Active Alerts ({props.activeAlertsConfigs.length})</h2>
              {props.activeAlertsConfigs.length === 0 ? <p className="text-sm text-slate-400 italic">No active alerts.</p> : props.activeAlertsConfigs.map(c => (
                 <div key={c.id} className="bg-white p-4 rounded-xl border border-cyan-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400"></div>
                    <div className="flex justify-between items-start">
                       <div>
                         <h3 className="font-bold text-slate-900">{c.targetName}</h3>
                         <p className="text-xs font-semibold text-cyan-600 mt-1">{c.combinationType.replace("_", " + ")}</p>
                       </div>
                       <button onClick={() => props.deleteCombination(c.id)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                    </div>
                 </div>
              ))}
           </div>
           
           <div className="space-y-4">
              <h2 className="text-sm font-black uppercase text-slate-500 tracking-wider flex items-center gap-1"><Clock size={16}/> Awaiting ({props.awaitingNextRaceConfigs.length})</h2>
              {props.awaitingNextRaceConfigs.length === 0 ? <p className="text-sm text-slate-400 italic">No configs waiting.</p> : props.awaitingNextRaceConfigs.map(c => (
                 <div key={c.runner} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>
                    <div className="flex justify-between items-start">
                       <div>
                         <h3 className="font-bold text-slate-900">{c.runner}</h3>
                         <p className="text-xs text-slate-500 mt-1 capitalize">{c.sport} • ${c.stake}</p>
                       </div>
                       <button onClick={() => props.removeConfig(c.runner)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
           <ExploreTab onAddToBlackbook={(e) => { props.setSearchEntity({ id: e.name, name: e.name, type: e.type as any }); props.setIsRuleBuilderOpen(true); }} />
        </div>
      )}
    </div>
  );
}

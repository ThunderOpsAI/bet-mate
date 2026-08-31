import { BookOpen, Search, Plus, Trash2, Clock, Calendar, Activity, Award, User, Filter } from "lucide-react";
import { BlackbookViewProps } from "./SharedProps";
import { ExploreTab } from "../../components/ExploreTab";

export function VariantC(props: BlackbookViewProps) {
  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden text-slate-800 font-sans">
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col p-4 shadow-sm z-10">
         <div className="flex items-center gap-2 mb-8 mt-2 px-2">
            <BookOpen size={20} className="text-blue-600"/>
            <h1 className="font-bold text-lg text-slate-900 tracking-tight m-0">Blackbook</h1>
         </div>
         <nav className="flex flex-col gap-1 flex-1">
            <button onClick={() => props.setActiveTab("list")} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${props.activeTab === "list" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>
               <Filter size={16}/> Feed
            </button>
            <button onClick={() => props.setActiveTab("explore")} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${props.activeTab === "explore" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>
               <Activity size={16}/> Explore
            </button>
         </nav>
         <button onClick={() => props.setShowComboBuilder(true)} className="mt-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
            <Plus size={16}/> Add Monitor
         </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 flex justify-between items-center">
           <h2 className="text-xl font-semibold m-0 text-slate-800">{props.activeTab === 'list' ? 'Your Feed' : 'Explore Markets'}</h2>
           <button onClick={() => props.setIsSearchOpen(true)} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full text-sm font-medium text-slate-600 transition-colors">
              <Search size={16}/> Search...
           </button>
        </header>

        <main className="p-8 max-w-4xl mx-auto">
          {props.activeTab === "list" ? (
             <div className="space-y-12">
               {props.runningTodayConfigs.length > 0 && (
                 <section>
                   <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Happening Today</h3>
                   <div className="space-y-3">
                     {props.runningTodayConfigs.map(c => (
                        <div key={c.runner} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
                           <div>
                              <h4 className="font-bold text-slate-900">{c.runner}</h4>
                              <p className="text-sm text-slate-500 mt-1 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Live</p>
                           </div>
                           <button onClick={() => props.removeConfig(c.runner)} className="text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
                        </div>
                     ))}
                   </div>
                 </section>
               )}

               <section>
                 <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Saved Alerts</h3>
                 <div className="space-y-3">
                   {props.activeAlertsConfigs.map(c => (
                      <div key={c.id} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow transition-shadow">
                         <div>
                            <h4 className="font-bold text-slate-900">{c.targetName}</h4>
                            <p className="text-sm text-slate-500 mt-1">{c.combinationType.replace("_", " + ")}</p>
                         </div>
                         <button onClick={() => props.deleteCombination(c.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
                      </div>
                   ))}
                 </div>
               </section>
             </div>
          ) : (
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
               <ExploreTab onAddToBlackbook={(e) => { props.setSearchEntity({ id: e.name, name: e.name, type: e.type as any }); props.setIsRuleBuilderOpen(true); }} />
             </div>
          )}
        </main>
      </div>
    </div>
  );
}

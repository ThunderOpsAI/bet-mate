"use client";

import React from "react";
import { Flame, Zap, TrendingUp, Calendar, ArrowRight, BarChart2, Activity } from "lucide-react";

export default function SportPrototypePage() {
  return (
    <div className="min-h-screen bg-[#0B0F19] pb-24 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Page Header */}
        <header className="flex items-center justify-between pb-4 border-b border-white/5">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Sport</h1>
            <p className="text-sm text-slate-400 mt-1">Pre-event analysis & live edges</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-1.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs font-bold uppercase tracking-wider">NBA</button>
            <button className="px-4 py-1.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold uppercase tracking-wider">NFL</button>
          </div>
        </header>

        {/* TOP: The Hero Feed (From B) */}
        <section>
          <div className="group relative h-[300px] rounded-3xl overflow-hidden bg-gradient-to-tr from-slate-900 to-slate-800 border border-white/10 flex flex-col justify-end p-8 transition-all hover:border-white/20">
            {/* Background pattern/glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-900/40 via-slate-900/0 to-transparent pointer-events-none" />
            
            <div className="absolute top-6 left-6 flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="text-rose-400 text-xs font-bold uppercase tracking-widest">Featured Edge</span>
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 text-slate-300 text-sm mb-3 font-medium">
                <Calendar size={16} className="text-slate-400"/>
                <span>Sunday 10:20am</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span className="text-emerald-400 font-bold">+15% Model Advantage</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Chiefs vs Ravens</h2>
              <button className="bg-white hover:bg-slate-100 text-slate-950 font-bold py-3.5 px-8 rounded-full flex items-center gap-2 transition-transform hover:scale-105 shadow-xl shadow-white/5">
                View Deep Stats <ArrowRight size={16} className="text-slate-500" />
              </button>
            </div>
          </div>
        </section>

        {/* BOTTOM: The Analytics Dashboard (From C) */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart2 size={20} className="text-slate-400"/>
              Algorithmic Insights
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lab Entry Points */}
            <button className="flex items-center justify-between p-6 bg-slate-900/50 hover:bg-slate-800/50 border border-white/5 hover:border-sky-500/30 rounded-2xl transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center border border-sky-500/20 group-hover:scale-110 transition-transform">
                  <Zap size={24} className="text-sky-400" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-white text-lg">NBA Lab</p>
                  <p className="text-sm text-slate-400">4 Active Edges Detected</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-600 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
            </button>

            <button className="flex items-center justify-between p-6 bg-slate-900/50 hover:bg-slate-800/50 border border-white/5 hover:border-rose-500/30 rounded-2xl transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20 group-hover:scale-110 transition-transform">
                  <Flame size={24} className="text-rose-400" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-white text-lg">NFL Lab</p>
                  <p className="text-sm text-slate-400">2 Active Edges Detected</p>
                </div>
              </div>
              <ArrowRight size={20} className="text-slate-600 group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
            </button>
          </div>

          {/* Model vs Market Table */}
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
              <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                <TrendingUp size={16} className="text-slate-400"/>
                Top Model vs Market Divergences
              </h4>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Live</span>
            </div>
            
            <div className="divide-y divide-white/5">
              {/* Row 1 */}
              <div className="p-5 flex justify-between items-center hover:bg-white/[0.02] transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 text-center">
                    <p className="text-[10px] text-sky-400 font-bold uppercase tracking-widest mb-1">NBA</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-200 text-lg group-hover:text-white transition-colors">Lakers ML</p>
                    <p className="text-xs text-slate-500">vs Celtics • Today 10:30am</p>
                  </div>
                </div>
                <div className="flex gap-8 text-right">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Market</p>
                    <p className="text-sm text-slate-300 font-medium">46%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Model</p>
                    <p className="text-sm text-emerald-400 font-bold">58%</p>
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div className="p-5 flex justify-between items-center hover:bg-white/[0.02] transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 text-center">
                    <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest mb-1">NFL</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-200 text-lg group-hover:text-white transition-colors">Chiefs -3.5</p>
                    <p className="text-xs text-slate-500">vs Ravens • Sun 10:20am</p>
                  </div>
                </div>
                <div className="flex gap-8 text-right">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Market</p>
                    <p className="text-sm text-slate-300 font-medium">50%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Model</p>
                    <p className="text-sm text-emerald-400 font-bold">65%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}


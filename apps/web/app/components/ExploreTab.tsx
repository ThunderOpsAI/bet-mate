"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, BadgeDollarSign, Award, Users, Clock, Plus, Info } from "lucide-react";
import { useAuth } from "../providers/AuthProvider";

type ExploreEntity = {
  name: string;
  type: string;
};

interface ExploreTabProps {
  onAddToBlackbook: (entity: ExploreEntity) => void;
}

type PickCard = {
  id: string;
  horseName: string;
  venue: string;
  raceNumber: number;
  jumpTime: string;
  winProbability: number;
  betfairOdds: number;
  isValue: boolean;
  edgePercent?: number;
};

type Leader = {
  id: string;
  name: string;
  raceCount: number;
  venues: string[];
  roi?: number | null;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function ExploreTab({ onAddToBlackbook }: ExploreTabProps) {
  const { token } = useAuth();
  
  const [hotPicks, setHotPicks] = useState<PickCard[]>([]);
  const [valuePlays, setValuePlays] = useState<PickCard[]>([]);
  const [topJockeys, setTopJockeys] = useState<Leader[]>([]);
  const [topTrainers, setTopTrainers] = useState<Leader[]>([]);
  
  const [loadingHot, setLoadingHot] = useState(true);
  const [loadingValue, setLoadingValue] = useState(true);
  const [loadingJockeys, setLoadingJockeys] = useState(true);
  const [loadingTrainers, setLoadingTrainers] = useState(true);

  useEffect(() => {
    const fetchExploreData = async () => {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Hot Picks
      fetch("/api/explore/hot-picks", { headers })
        .then(res => res.json())
        .then(data => {
          setHotPicks(data?.data || []);
          setLoadingHot(false);
        })
        .catch(() => setLoadingHot(false));

      // Value Plays
      fetch("/api/explore/value-plays", { headers })
        .then(res => res.json())
        .then(data => {
          setValuePlays(data?.data || []);
          setLoadingValue(false);
        })
        .catch(() => setLoadingValue(false));

      // Top Jockeys
      fetch("/api/explore/top-jockeys", { headers })
        .then(res => res.json())
        .then(data => {
          setTopJockeys(data?.data || []);
          setLoadingJockeys(false);
        })
        .catch(() => setLoadingJockeys(false));

      // Top Trainers
      fetch("/api/explore/top-trainers", { headers })
        .then(res => res.json())
        .then(data => {
          setTopTrainers(data?.data || []);
          setLoadingTrainers(false);
        })
        .catch(() => setLoadingTrainers(false));
    };

    fetchExploreData();
  }, [token]);

  const renderPickCard = (pick: PickCard) => (
    <motion.div key={pick.id} variants={itemVariants} className="bg-white/60 backdrop-blur-md border border-slate-200/60 shadow-sm rounded-2xl p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-bold text-lg text-slate-800 leading-tight">{pick.horseName}</h4>
          {pick.isValue && (
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-emerald-200">
              ⚡ {pick.edgePercent ? `+${pick.edgePercent}% Edge` : 'VALUE'}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-slate-500 mb-4">{pick.venue} • R{pick.raceNumber}</p>
      </div>
      
      <div className="flex items-end justify-between mt-auto">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12}/> {pick.jumpTime}</span>
          <span className="text-sm font-semibold text-cyan-700">{pick.winProbability}% ML</span>
        </div>
        <div className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-center">
          <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Betfair</span>
          <span className="font-black text-slate-800">${pick.betfairOdds?.toFixed(2) || '-.--'}</span>
        </div>
      </div>
    </motion.div>
  );

  const renderLeaderRow = (leader: Leader, index: number, type: string) => (
    <motion.div key={leader.id} variants={itemVariants} className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors group rounded-xl">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 font-bold flex items-center justify-center text-sm border border-slate-200">
          #{index + 1}
        </div>
        <div>
          <h4 className="font-bold text-slate-800">{leader.name}</h4>
          <p className="text-xs text-slate-500">{leader.raceCount} rides • {leader.venues.join(', ')}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block relative group-hover:opacity-100 transition-opacity">
          <div className="text-xs font-semibold text-slate-400 flex items-center gap-1 justify-end cursor-help">
            ROI {leader.roi === null || leader.roi === undefined ? 'N/A' : `${leader.roi}%`}
            {(leader.roi === null || leader.roi === undefined) && <Info size={12} />}
          </div>
          {(leader.roi === null || leader.roi === undefined) && (
            <div className="absolute right-0 bottom-full mb-1 w-32 bg-slate-800 text-white text-[10px] p-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity text-center z-10">
              Historical ROI coming soon
            </div>
          )}
        </div>
        <button 
          onClick={() => onAddToBlackbook({ name: leader.name, type })}
          className="bg-cyan-50 text-cyan-700 hover:bg-cyan-100 p-2 rounded-lg transition-colors border border-cyan-100 flex items-center gap-1 text-sm font-semibold"
          title="Add to BlackBook"
        >
          <Plus size={16} /> <span className="hidden sm:inline">Add</span>
        </button>
      </div>
    </motion.div>
  );

  const renderSkeletonGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white/40 border border-slate-200/50 rounded-2xl p-4 h-36 flex flex-col justify-between animate-pulse">
          <div>
            <div className="h-5 bg-slate-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-slate-100 rounded w-1/3"></div>
          </div>
          <div className="flex justify-between items-end">
            <div className="h-8 bg-slate-100 rounded w-1/4"></div>
            <div className="h-10 bg-slate-200 rounded w-1/4"></div>
          </div>
        </div>
      ))}
    </div>
  );
  
  const renderSkeletonList = () => (
    <div className="flex flex-col">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center justify-between p-3 border-b border-slate-100 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-200"></div>
            <div>
              <div className="h-4 bg-slate-200 rounded w-24 mb-1"></div>
              <div className="h-3 bg-slate-100 rounded w-32"></div>
            </div>
          </div>
          <div className="w-16 h-8 bg-slate-200 rounded-lg"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-10 pb-12">
      {/* Hot Right Now Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Flame className="text-orange-500" size={24} />
          <h2 className="text-xl font-extrabold text-slate-800">Hot Right Now</h2>
        </div>
        
        {loadingHot ? renderSkeletonGrid() : hotPicks.length > 0 ? (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotPicks.map(renderPickCard)}
          </motion.div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
            <Flame className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-slate-500 font-medium">No hot picks available right now. Check back closer to race time.</p>
          </div>
        )}
      </section>

      {/* Best Value Plays Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BadgeDollarSign className="text-emerald-500" size={24} />
          <h2 className="text-xl font-extrabold text-slate-800">Best Value Plays</h2>
        </div>
        
        {loadingValue ? renderSkeletonGrid() : valuePlays.length > 0 ? (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {valuePlays.map(renderPickCard)}
          </motion.div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center">
            <BadgeDollarSign className="mx-auto text-slate-300 mb-2" size={32} />
            <p className="text-slate-500 font-medium">No value plays detected today.</p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Jockeys Today */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="text-blue-500" size={20} />
            <h2 className="text-lg font-bold text-slate-800">Top Jockeys Today</h2>
          </div>
          
          {loadingJockeys ? renderSkeletonList() : topJockeys.length > 0 ? (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col">
              {topJockeys.map((j, i) => renderLeaderRow(j, i, 'jockey'))}
            </motion.div>
          ) : (
            <p className="text-slate-500 text-center py-6">No jockey data available.</p>
          )}
        </section>

        {/* Top Trainers Today */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="text-purple-500" size={20} />
            <h2 className="text-lg font-bold text-slate-800">Top Trainers Today</h2>
          </div>
          
          {loadingTrainers ? renderSkeletonList() : topTrainers.length > 0 ? (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col">
              {topTrainers.map((t, i) => renderLeaderRow(t, i, 'trainer'))}
            </motion.div>
          ) : (
            <p className="text-slate-500 text-center py-6">No trainer data available.</p>
          )}
        </section>
      </div>
    </div>
  );
}

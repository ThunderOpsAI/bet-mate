"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, AlertCircle } from "lucide-react";

export type SearchResult = {
  id: string;
  name: string;
  type: "horse" | "jockey" | "trainer";
  venue?: string;
  raceNumber?: number;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entity: SearchResult) => void;
}

export function BlackbookSearchModal({ isOpen, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length === 1) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/blackbook/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const horses = results.filter((r) => r.type === "horse");
  const jockeys = results.filter((r) => r.type === "jockey");
  const trainers = results.filter((r) => r.type === "trainer");

  const renderSection = (title: string, items: SearchResult[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-500 mb-2 uppercase">{title}</h3>
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item);
                onClose();
              }}
              className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
            >
              <span className="font-semibold text-gray-900">{item.name}</span>
              {item.venue && item.raceNumber && (
                <span className="text-xs text-gray-500">
                  {item.venue} R{item.raceNumber}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden mt-10"
          >
            <div className="flex items-center gap-3 p-4 border-b border-gray-100">
              <Search className="text-gray-400" size={20} />
              <input
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-lg text-gray-900 placeholder:text-gray-400"
                placeholder="Search horses, jockeys, trainers..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {loading && <div className="text-center p-4 text-gray-500">Searching...</div>}
              
              {!loading && query.trim().length >= 2 && results.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-gray-500 gap-2">
                  <AlertCircle size={32} className="text-gray-300 mb-2" />
                  <p className="text-center font-medium">No active runners found today for &quot;{query}&quot;</p>
                  <p className="text-xs text-gray-400 text-center max-w-sm mb-4">
                    The live feed only sees today's races. You can still add this to your Blackbook to catch them next time they run:
                  </p>
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    <button
                      onClick={() => {
                        onSelect({ id: `custom-horse-${query}`, name: query, type: "horse" });
                        onClose();
                      }}
                      className="w-full py-2 px-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg hover:bg-emerald-100 font-semibold transition-colors"
                    >
                      Add &quot;{query}&quot; as Horse
                    </button>
                    <button
                      onClick={() => {
                        onSelect({ id: `custom-jockey-${query}`, name: query, type: "jockey" });
                        onClose();
                      }}
                      className="w-full py-2 px-4 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg hover:bg-blue-100 font-semibold transition-colors"
                    >
                      Add &quot;{query}&quot; as Jockey
                    </button>
                    <button
                      onClick={() => {
                        onSelect({ id: `custom-trainer-${query}`, name: query, type: "trainer" });
                        onClose();
                      }}
                      className="w-full py-2 px-4 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg hover:bg-purple-100 font-semibold transition-colors"
                    >
                      Add &quot;{query}&quot; as Trainer
                    </button>
                  </div>
                </div>
              )}

              {!loading && results.length > 0 && (
                <>
                  {renderSection("Horses", horses)}
                  {renderSection("Jockeys", jockeys)}
                  {renderSection("Trainers", trainers)}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

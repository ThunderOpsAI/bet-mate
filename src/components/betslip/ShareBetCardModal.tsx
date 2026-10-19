import React, { useRef, useState, useMemo } from "react";
import {
  X,
  Share2,
  Download,
  Copy,
  Check,
  Award,
  Sparkles,
  TrendingUp,
  Calendar,
  Layers,
  Zap,
  ShieldCheck,
  Target,
  Flame,
  FileText,
  Sliders,
} from "lucide-react";
import { useBetslip } from "../../context/BetslipContext";
import type { PaperBetItem } from "../../types";

export const ShareBetCardModal: React.FC = () => {
  const { isShareCardOpen, shareCardBet, closeShareCard, settledBets, addToast } = useBetslip();
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<"auto" | "aurora" | "nebula" | "solar">("auto");

  // If no specific bet was passed, grab the best winning bet
  const currentBet: PaperBetItem | null =
    shareCardBet ||
    settledBets.filter((b) => b.status === "won").sort((a, b) => (b.payout || 0) - (a.payout || 0))[0] ||
    settledBets[0] ||
    null;

  const stake = currentBet?.stake || 20;
  const payout = currentBet ? (currentBet.payout || currentBet.odds * stake) : 40;
  const netProfit = payout - stake;
  const roi = stake > 0 ? (netProfit / stake) * 100 : 0;
  const odds = currentBet?.odds || 2.0;
  const dateFormatted = currentBet?.settled_at
    ? new Date(currentBet.settled_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // Calculate Win Probability
  const winProbability = useMemo(() => {
    if (!currentBet) return 50;
    if (currentBet.probability) return currentBet.probability;
    if (currentBet.fair_odds && currentBet.fair_odds > 0) {
      return Math.min(96, Math.max(8, Math.round((1 / currentBet.fair_odds) * 100)));
    }
    const implied = (1 / (currentBet.odds || 2.0)) * 100;
    const edge = currentBet.edge_pct || 15;
    return Math.min(95, Math.max(10, Math.round(implied + edge * 0.75)));
  }, [currentBet]);

  // Determine active theme
  const activeTheme = useMemo(() => {
    if (selectedTheme !== "auto") return selectedTheme;
    if (winProbability >= 58) return "aurora";
    if (winProbability >= 35) return "nebula";
    return "solar";
  }, [selectedTheme, winProbability]);

  // Theme presets
  const themeConfig = useMemo(() => {
    switch (activeTheme) {
      case "aurora":
        return {
          id: "aurora",
          label: "Aurora Emerald",
          badge: "MODEL LOCK • HIGH PROBABILITY",
          badgeIcon: ShieldCheck,
          badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          cardGradient: "from-emerald-950 via-slate-950 to-teal-950/90",
          border: "border-emerald-500/40",
          glowColor1: "bg-emerald-500/20",
          glowColor2: "bg-teal-500/15",
          titleGradient: "from-white via-emerald-100 to-teal-300",
          accentColor: "#10b981",
          secondaryAccent: "#14b8a6",
          bgCanvasStart: "#022c22",
          bgCanvasMid: "#06181b",
          bgCanvasEnd: "#02120e",
          meterColor: "text-emerald-400",
          multiplierText: "High Confidence Lock",
        };
      case "nebula":
        return {
          id: "nebula",
          label: "Electric Nebula",
          badge: "QUANT VALUE • BALANCED STRIKE",
          badgeIcon: Target,
          badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
          cardGradient: "from-indigo-950 via-slate-950 to-purple-950/90",
          border: "border-indigo-500/40",
          glowColor1: "bg-indigo-500/20",
          glowColor2: "bg-purple-500/15",
          titleGradient: "from-white via-indigo-100 to-cyan-300",
          accentColor: "#6366f1",
          secondaryAccent: "#06b6d4",
          bgCanvasStart: "#1e1b4b",
          bgCanvasMid: "#0c0a2a",
          bgCanvasEnd: "#1e1035",
          meterColor: "text-indigo-400",
          multiplierText: "Balanced EV Strike",
        };
      case "solar":
      default:
        return {
          id: "solar",
          label: "Solar Flare",
          badge: "LONGSHOT ALPHA • HIGH MULTIPLIER",
          badgeIcon: Flame,
          badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          cardGradient: "from-amber-950/90 via-slate-950 to-rose-950/90",
          border: "border-amber-500/40",
          glowColor1: "bg-amber-500/20",
          glowColor2: "bg-rose-500/20",
          titleGradient: "from-amber-100 via-amber-200 to-rose-300",
          accentColor: "#f59e0b",
          secondaryAccent: "#f43f5e",
          bgCanvasStart: "#451a03",
          bgCanvasMid: "#18060a",
          bgCanvasEnd: "#3a0614",
          meterColor: "text-amber-400",
          multiplierText: `${(payout / (stake || 1)).toFixed(1)}x High Multiplier`,
        };
    }
  }, [activeTheme, payout, stake]);

  if (!isShareCardOpen || !currentBet) return null;

  // Generate and download high-resolution 1080x1080 image using HTML5 Canvas
  const handleDownloadImage = () => {
    setIsGenerating(true);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = 1080;
      canvas.height = 1080;

      // 1. Rich multi-stop background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
      bgGrad.addColorStop(0, themeConfig.bgCanvasStart);
      bgGrad.addColorStop(0.5, themeConfig.bgCanvasMid);
      bgGrad.addColorStop(1, themeConfig.bgCanvasEnd);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1080);

      // 2. Ambient glowing radial lights
      const radGrad1 = ctx.createRadialGradient(900, 200, 10, 900, 200, 480);
      radGrad1.addColorStop(0, themeConfig.accentColor + "44");
      radGrad1.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = radGrad1;
      ctx.fillRect(0, 0, 1080, 1080);

      const radGrad2 = ctx.createRadialGradient(180, 880, 10, 180, 880, 450);
      radGrad2.addColorStop(0, themeConfig.secondaryAccent + "33");
      radGrad2.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = radGrad2;
      ctx.fillRect(0, 0, 1080, 1080);

      // 3. Subtle cyber grid matrix lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 1;
      for (let x = 60; x < 1080; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(x, 1040);
        ctx.stroke();
      }
      for (let y = 60; y < 1080; y += 60) {
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(1040, y);
        ctx.stroke();
      }

      // 4. Card frame border
      ctx.strokeStyle = themeConfig.accentColor + "88";
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, 1000, 1000);

      // Corner accent brackets
      const bracketSize = 24;
      ctx.strokeStyle = themeConfig.secondaryAccent;
      ctx.lineWidth = 6;
      // Top left
      ctx.beginPath();
      ctx.moveTo(40, 40 + bracketSize);
      ctx.lineTo(40, 40);
      ctx.lineTo(40 + bracketSize, 40);
      ctx.stroke();
      // Top right
      ctx.beginPath();
      ctx.moveTo(1040 - bracketSize, 40);
      ctx.lineTo(1040, 40);
      ctx.lineTo(1040, 40 + bracketSize);
      ctx.stroke();
      // Bottom left
      ctx.beginPath();
      ctx.moveTo(40, 1040 - bracketSize);
      ctx.lineTo(40, 1040);
      ctx.lineTo(40 + bracketSize, 1040);
      ctx.stroke();
      // Bottom right
      ctx.beginPath();
      ctx.moveTo(1040 - bracketSize, 1040);
      ctx.lineTo(1040, 1040);
      ctx.lineTo(1040, 1040 - bracketSize);
      ctx.stroke();

      // Brand Header
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 36px sans-serif";
      ctx.fillText("BETMATE", 80, 115);

      ctx.fillStyle = themeConfig.accentColor;
      ctx.fillText("• AI QUANT", 260, 115);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText(themeConfig.badge, 540, 115);

      // Divider line
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 150);
      ctx.lineTo(1000, 150);
      ctx.stroke();

      // Win Probability Gauge Pill (Top Hero)
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = themeConfig.accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(80, 180, 920, 65, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = themeConfig.accentColor;
      ctx.font = "900 24px sans-serif";
      ctx.fillText(`MODEL WIN PROBABILITY: ${winProbability}%`, 110, 222);

      // Progress bar fill inside pill
      const barX = 540;
      const barY = 202;
      const barW = 320;
      const barH = 20;
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 8);
      ctx.fill();

      ctx.fillStyle = themeConfig.accentColor;
      ctx.beginPath();
      ctx.roundRect(barX, barY, (barW * winProbability) / 100, barH, 8);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText(themeConfig.multiplierText, 880, 218);

      // Event & Date
      ctx.fillStyle = themeConfig.secondaryAccent;
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(
        `${currentBet.sport.toUpperCase()} • ${currentBet.event_name.toUpperCase()}`,
        80,
        290
      );

      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 22px sans-serif";
      ctx.fillText(`Settled: ${dateFormatted}`, 750, 290);

      // Dynamic Typography: Selection Name
      // Dynamically scale font based on length
      let titleFontSize = 66;
      if (currentBet.selection.length > 20) titleFontSize = 54;
      if (currentBet.selection.length > 28) titleFontSize = 46;

      ctx.fillStyle = "#ffffff";
      ctx.font = `900 ${titleFontSize}px sans-serif`;
      ctx.fillText(currentBet.selection, 80, 375);

      // Financial Metrics Row (Taken Odds, Model Fair, Quant Overlay)
      // Pill 1: Taken Odds
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.strokeStyle = themeConfig.accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(80, 425, 280, 95, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("TAKEN ODDS", 105, 460);
      ctx.fillStyle = themeConfig.accentColor;
      ctx.font = "900 44px monospace";
      ctx.fillText(`$${odds.toFixed(2)}`, 105, 502);

      // Pill 2: Model Fair
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.strokeStyle = themeConfig.secondaryAccent;
      ctx.beginPath();
      ctx.roundRect(390, 425, 280, 95, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("MODEL FAIR", 415, 460);
      ctx.fillStyle = themeConfig.secondaryAccent;
      ctx.font = "900 44px monospace";
      ctx.fillText(currentBet.fair_odds ? `$${currentBet.fair_odds.toFixed(2)}` : "$2.10", 415, 502);

      // Pill 3: Edge Overlay
      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.strokeStyle = "#f59e0b";
      ctx.beginPath();
      ctx.roundRect(700, 425, 300, 95, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("MODEL EDGE OVERLAY", 725, 460);
      ctx.fillStyle = "#f59e0b";
      ctx.font = "900 44px monospace";
      ctx.fillText(`+${currentBet.edge_pct || 22}%`, 725, 502);

      // Hero Profit & Payout Box
      ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(80, 545, 920, 240, 24);
      ctx.fill();
      ctx.stroke();

      // Return details inside Hero Box
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("PAPER STAKE", 130, 610);
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 46px monospace";
      ctx.fillText(`$${stake.toFixed(2)}`, 130, 670);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("TOTAL PAYOUT", 430, 610);
      ctx.fillStyle = themeConfig.accentColor;
      ctx.font = "900 46px monospace";
      ctx.fillText(`$${payout.toFixed(2)}`, 430, 670);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("NET PROFIT", 730, 610);
      ctx.fillStyle = "#34d399";
      ctx.font = "900 46px monospace";
      ctx.fillText(`+$${netProfit.toFixed(2)}`, 730, 670);

      // ROI Banner
      ctx.fillStyle = themeConfig.accentColor;
      ctx.font = "bold 26px sans-serif";
      ctx.fillText(`🚀 RETURN ON INVESTMENT: +${roi.toFixed(1)}%`, 130, 750);

      // Custom Betting Notes / Thesis (if present)
      if (currentBet.notes) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.strokeStyle = themeConfig.secondaryAccent + "66";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(80, 810, 920, 75, 14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = themeConfig.secondaryAccent;
        ctx.font = "bold 18px sans-serif";
        ctx.fillText("STRATEGY THESIS:", 110, 845);

        ctx.fillStyle = "#e2e8f0";
        ctx.font = "italic 20px sans-serif";
        const truncatedNote =
          currentBet.notes.length > 70 ? currentBet.notes.slice(0, 68) + "..." : currentBet.notes;
        ctx.fillText(`"${truncatedNote}"`, 320, 845);
      } else if (currentBet.settlement_notes) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "italic 20px sans-serif";
        const sNote =
          currentBet.settlement_notes.length > 80
            ? currentBet.settlement_notes.slice(0, 78) + "..."
            : currentBet.settlement_notes;
        ctx.fillText(`"${sNote}"`, 80, 845);
      }

      // Footer Watermark & ID
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(80, 910);
      ctx.lineTo(1000, 910);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("BETMATE QUANT ENGINE • VERIFIED SIMULATION LEDGER", 80, 960);
      ctx.fillText(`WAGER ID: #${currentBet.id.toUpperCase()}`, 720, 960);

      // Trigger download
      const imageURL = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `betmate-${themeConfig.id}-${currentBet.selection
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")}.png`;
      link.href = imageURL;
      link.click();

      addToast("Winning bet ticket exported as 1080p graphic PNG!", "success");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = () => {
    const text = `🎉 BetMate Value Winner!\n🎯 Selection: ${currentBet.selection}\n📍 Event: ${
      currentBet.event_name
    }\n⚡ Win Probability: ${winProbability}% (${themeConfig.badge})\n💰 Odds: $${odds.toFixed(
      2
    )} (Fair: $${currentBet.fair_odds?.toFixed(2) || "2.00"} | +${
      currentBet.edge_pct || 15
    }% EV Overlay)\n💵 Stake: $${stake.toFixed(2)} ➡️ Payout: $${payout.toFixed(2)} (+${roi.toFixed(
      1
    )}% ROI)\n${
      currentBet.notes ? `📝 Thesis: "${currentBet.notes}"\n` : ""
    }📅 Date: ${dateFormatted}\n\nShared via BetMate AI Sports Platform`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    addToast("Winning bet summary copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2500);
  };

  const winningBets = settledBets.filter((b) => b.status === "won");
  const BadgeIcon = themeConfig.badgeIcon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Share2 size={16} />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <span>Shareable Bet Ticket</span>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {winProbability}% Probability
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                High-impact dynamic graphic card with probability-tuned typography
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeShareCard}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Gradient & Probability Theme Selector */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1.5 pl-1 shrink-0">
              <Sliders size={13} className="text-cyan-400" />
              <span>Card Gradient:</span>
            </span>

            <div className="flex items-center gap-1 overflow-x-auto">
              {[
                { key: "auto", label: "Auto (Prob)" },
                { key: "aurora", label: "Emerald (Lock)" },
                { key: "nebula", label: "Nebula (Value)" },
                { key: "solar", label: "Solar (High Yield)" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedTheme(t.key as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedTheme === t.key
                      ? "bg-slate-800 text-white border border-slate-600 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* DYNAMIC CARD PREVIEW */}
          <div
            ref={cardRef}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${themeConfig.cardGradient} border ${themeConfig.border} p-5 sm:p-6 shadow-2xl space-y-4 text-slate-100 transition-all`}
          >
            {/* Glowing background ambient orbs */}
            <div
              className={`absolute top-0 right-0 -mt-10 -mr-10 w-56 h-56 ${themeConfig.glowColor1} rounded-full blur-3xl pointer-events-none`}
            />
            <div
              className={`absolute bottom-0 left-0 -mb-10 -ml-10 w-48 h-48 ${themeConfig.glowColor2} rounded-full blur-3xl pointer-events-none`}
            />

            {/* Ticket Header & Probability Pill */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white font-mono">
                  BET<span className="text-emerald-400">MATE</span>
                </span>
                <span
                  className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${themeConfig.badgeColor}`}
                >
                  <BadgeIcon size={10} />
                  <span>{themeConfig.badge}</span>
                </span>
              </div>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <Calendar size={12} className="text-slate-500" />
                {dateFormatted}
              </span>
            </div>

            {/* Win Probability Banner Gauge */}
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center font-mono font-black text-xs text-white">
                  {winProbability}%
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Model Win Probability
                  </span>
                  <span className={`text-xs font-black ${themeConfig.meterColor}`}>
                    {themeConfig.multiplierText}
                  </span>
                </div>
              </div>

              {/* Mini probability gauge bar */}
              <div className="w-32 sm:w-44 h-2 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${winProbability}%`,
                    backgroundColor: themeConfig.accentColor,
                  }}
                />
              </div>
            </div>

            {/* Selection & Event with Dynamic Typography */}
            <div className="relative z-10">
              <span className="text-xs font-black uppercase tracking-wider block text-cyan-400">
                {currentBet.sport.toUpperCase()} • {currentBet.event_name}
              </span>
              <h2
                className={`text-2xl sm:text-3xl font-black tracking-tight mt-1 text-transparent bg-clip-text bg-gradient-to-r ${themeConfig.titleGradient} drop-shadow-sm`}
              >
                {currentBet.selection}
              </h2>
            </div>

            {/* Odds & Model Edge Chips */}
            <div className="grid grid-cols-3 gap-2 py-1 relative z-10">
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Taken Odds
                </span>
                <span className="text-base sm:text-lg font-mono font-black text-emerald-400">
                  ${odds.toFixed(2)}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Model Fair
                </span>
                <span className="text-base sm:text-lg font-mono font-black text-cyan-300">
                  ${currentBet.fair_odds?.toFixed(2) || "2.10"}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Quant Overlay
                </span>
                <span className="text-base sm:text-lg font-mono font-black text-amber-400">
                  +{currentBet.edge_pct || 21}%
                </span>
              </div>
            </div>

            {/* Hero Profit & Payout Box */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-white/10 flex items-center justify-between relative z-10 shadow-lg">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                  Net Paper Profit
                </span>
                <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
                  +${netProfit.toFixed(2)}
                </span>
                <span className="text-[11px] text-emerald-200/90 block mt-0.5 font-semibold">
                  ROI: +{roi.toFixed(1)}%
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Total Payout
                </span>
                <span className="text-xl font-mono font-bold text-white">
                  ${payout.toFixed(2)}
                </span>
                <span className="text-[11px] text-slate-400 block font-mono">
                  Stake: ${stake.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Custom Strategy Thesis Notes (if present) */}
            {currentBet.notes ? (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 text-xs text-slate-300 space-y-1 relative z-10">
                <span className="text-[10px] uppercase font-bold text-cyan-400 flex items-center gap-1.5">
                  <FileText size={11} />
                  <span>Strategy Thesis &amp; Notes</span>
                </span>
                <p className="italic text-slate-200 text-xs">"{currentBet.notes}"</p>
              </div>
            ) : currentBet.settlement_notes ? (
              <p className="text-xs text-slate-400 italic bg-slate-950/60 p-2.5 rounded-lg border border-white/10 relative z-10">
                "{currentBet.settlement_notes}"
              </p>
            ) : null}

            {/* Security Stamp & Verification */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] text-slate-500 font-mono relative z-10">
              <span>BETMATE QUANTITATIVE AUDIT</span>
              <span>ID: #{currentBet.id.slice(0, 12).toUpperCase()}</span>
            </div>
          </div>

          {/* Quick Winning Bet Selector if multiple exist */}
          {winningBets.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 shrink-0 font-semibold text-[11px]">
                Switch Winning Bet:
              </span>
              {winningBets.slice(0, 5).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => useBetslip().openShareCard(w)}
                  className={`px-2.5 py-1 rounded-lg shrink-0 font-bold border transition-colors cursor-pointer ${
                    w.id === currentBet.id
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {w.selection.slice(0, 15)} (${w.odds.toFixed(2)})
                </button>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleDownloadImage}
              className="py-3 px-4 rounded-xl font-black text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 hover:scale-[1.01]"
            >
              <Download size={16} />
              <span>{isGenerating ? "Exporting PNG..." : "Download as Image"}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="py-3 px-4 rounded-xl font-bold text-xs sm:text-sm bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              <span>{copied ? "Copied!" : "Copy Text Summary"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

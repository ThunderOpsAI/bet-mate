import React, { useState, useEffect } from "react";
import { AuthProvider } from "./context/AuthContext";
import { BetslipProvider } from "./context/BetslipContext";
import { BlackbookProvider } from "./context/BlackbookContext";
import { SyndicateProvider } from "./context/SyndicateContext";
import { AppShell } from "./components/layout/AppShell";
import { PaperBetslipDrawer } from "./components/betslip/PaperBetslipDrawer";
import { PostMortemModal } from "./components/betslip/PostMortemModal";
import { QuickBetModal } from "./components/betslip/QuickBetModal";
import { ShareBetCardModal } from "./components/betslip/ShareBetCardModal";
import { AskBobModal } from "./components/bob/AskBobModal";

// Views
import { HomeView } from "./components/views/HomeView";
import { TodayView } from "./components/views/TodayView";
import { RacingView } from "./components/views/RacingView";
import { SportView } from "./components/views/SportView";
import { MultiBuilderView } from "./components/views/MultiBuilderView";
import { BetsView } from "./components/views/BetsView";
import { BlackbookView } from "./components/views/BlackbookView";
import { StrategyLabView } from "./components/views/StrategyLabView";
import { AnalyticsView } from "./components/views/AnalyticsView";
import { SyndicatesView } from "./components/views/SyndicatesView";
import { SettingsView } from "./components/views/SettingsView";
import { HowItWorksView } from "./components/views/HowItWorksView";
import { LegalView } from "./components/views/LegalView";

import type { BobExplanation } from "./lib/bob/explainer";
import type { SportCode } from "./types";

function MainApp() {
  const [currentView, setCurrentView] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (hash) return hash;
      const path = window.location.pathname.replace(/^\//, "");
      if (path) return path;
    }
    return "home";
  });

  const [activeBobExplanation, setActiveBobExplanation] = useState<BobExplanation | null>(null);

  // Sync hash routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        setCurrentView(hash);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleNavigate = (view: string) => {
    setCurrentView(view);
    if (typeof window !== "undefined") {
      window.location.hash = view;
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleOpenBob = (explanation: BobExplanation) => {
    setActiveBobExplanation(explanation);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case "home":
        return <HomeView onNavigate={handleNavigate} onOpenBob={handleOpenBob} />;
      case "today":
        return <TodayView onNavigate={handleNavigate} onOpenBob={handleOpenBob} />;
      case "racing":
        return <RacingView onOpenBob={handleOpenBob} />;
      case "sport":
        return <SportView onOpenBob={handleOpenBob} onNavigate={handleNavigate} />;
      case "nba":
        return <SportView initialSport="nba" onOpenBob={handleOpenBob} onNavigate={handleNavigate} />;
      case "afl":
        return <SportView initialSport="afl" onOpenBob={handleOpenBob} onNavigate={handleNavigate} />;
      case "nrl":
        return <SportView initialSport="nrl" onOpenBob={handleOpenBob} onNavigate={handleNavigate} />;
      case "soccer":
        return <SportView initialSport="soccer" onOpenBob={handleOpenBob} onNavigate={handleNavigate} />;
      case "golf":
        return <SportView initialSport="golf" onOpenBob={handleOpenBob} onNavigate={handleNavigate} />;
      case "mma":
        return <SportView initialSport="mma" onOpenBob={handleOpenBob} onNavigate={handleNavigate} />;
      case "multi-builder":
      case "high-ev":
        return <MultiBuilderView />;
      case "bets":
        return <BetsView onNavigate={handleNavigate} />;
      case "blackbook":
        return <BlackbookView />;
      case "strategy":
        return <StrategyLabView />;
      case "analytics":
        return <AnalyticsView />;
      case "mates":
        return <SyndicatesView />;
      case "settings":
        return <SettingsView />;
      case "how-it-works":
        return <HowItWorksView onNavigate={handleNavigate} />;
      case "legal":
        return <LegalView onBack={() => handleNavigate("home")} />;
      default:
        return <HomeView onNavigate={handleNavigate} onOpenBob={handleOpenBob} />;
    }
  };

  return (
    <AppShell currentView={currentView} onNavigate={handleNavigate} onOpenBob={handleOpenBob}>
      {renderCurrentView()}
      <PaperBetslipDrawer />
      <PostMortemModal />
      <QuickBetModal />
      <ShareBetCardModal />
      <AskBobModal
        isOpen={Boolean(activeBobExplanation)}
        onClose={() => setActiveBobExplanation(null)}
        explanation={activeBobExplanation}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BetslipProvider>
        <BlackbookProvider>
          <SyndicateProvider>
            <MainApp />
          </SyndicateProvider>
        </BlackbookProvider>
      </BetslipProvider>
    </AuthProvider>
  );
}

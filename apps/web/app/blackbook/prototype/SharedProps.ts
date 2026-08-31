import { SearchResult } from "../../components/BlackbookSearchModal";

export type BlackbookViewProps = {
  activeTab: "explore" | "list";
  setActiveTab: (v: "explore" | "list") => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (v: boolean) => void;
  showComboBuilder: boolean;
  setShowComboBuilder: (v: boolean) => void;
  searchEntity: SearchResult | null;
  setSearchEntity: (v: SearchResult | null) => void;
  isRuleBuilderOpen: boolean;
  setIsRuleBuilderOpen: (v: boolean) => void;
  fetchConfigs: () => void;
  
  runningTodayConfigs: any[];
  activeAlertsConfigs: any[];
  awaitingNextRaceConfigs: any[];
  dailyRunners: any[];
  dailyRunnersLoading: boolean;
  
  removeConfig: (runner: string) => void;
  deleteCombination: (id: string) => void;
  
  comboDraft: any;
  setComboDraft: (v: any) => void;
  saveCombination: (e: any) => void;
  savingCombo: boolean;
};

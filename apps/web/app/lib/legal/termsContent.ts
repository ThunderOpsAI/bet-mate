export interface LegalSection {
  id: string;
  title: string;
  content: string[];
  isNotice?: boolean;
}

export interface TermsContent {
  title: string;
  subtitle: string;
  lastUpdated: string;
  version: string;
  paperBettingNotice: string;
  sections: LegalSection[];
}

export const termsContent: TermsContent = {
  title: "Terms & Conditions",
  subtitle: "Rules and terms governing the use of BetMate quantitative analysis and paper betting tools.",
  lastUpdated: "August 7, 2026",
  version: "1.0.0-draft",
  paperBettingNotice:
    "Simulated Paper Betting Notice: All bets, wagers, bankrolls, and payouts on BetMate are 100% simulated paper bets for research and entertainment purposes. No real money changes hands.",
  sections: [
    {
      id: "simulated-betting",
      title: "1. Simulated Paper Betting & Financial Disclaimer",
      content: [
        "Simulated Paper Betting Notice: All bets, wagers, bankrolls, and payouts on BetMate are 100% simulated paper bets for research and entertainment purposes. No real money changes hands.",
        "BetMate is strictly a quantitative analysis, strategy modeling, and paper-betting simulation platform. It is not an online bookmaker, gambling operator, or financial advising service.",
        "No real currency, deposits, or real-money payouts are accepted or processed on the platform.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
      isNotice: true,
    },
    {
      id: "acceptance-of-terms",
      title: "2. Acceptance of Terms",
      content: [
        "By accessing or using the BetMate platform, web application, or associated APIs, you agree to be bound by these Terms & Conditions.",
        "If you do not agree to all terms herein, you must immediately cease all access and use of the platform.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
    {
      id: "user-eligibility",
      title: "3. User Eligibility & Responsible Use",
      content: [
        "Users must be at least 18 years of age (or the legal age of majority in their jurisdiction) to register an account.",
        "BetMate encourages responsible strategy testing and risk awareness. Always gamble responsibly when engaging with real-world betting markets.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
    {
      id: "account-registration",
      title: "4. Account Registration & Security",
      content: [
        "Users are responsible for maintaining the confidentiality of their account credentials and for all activities under their account.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
    {
      id: "intellectual-property",
      title: "5. Quantitative Models & Intellectual Property",
      content: [
        "All algorithms, predictive ML models, strategy scoring mechanisms, code, and user interface designs remain the exclusive property of BetMate.",
        "Users receive a limited, non-exclusive, non-transferable license for personal, non-commercial use of the platform.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
    {
      id: "limitation-of-liability",
      title: "6. Limitation of Liability & No Guarantees",
      content: [
        "Predictions, expected value (+EV) calculations, and model probabilities are statistical estimations provided for informational and simulation purposes only.",
        "Past performance of predictive models is not indicative of future results in real-world sporting or racing events.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
    {
      id: "modifications",
      title: "7. Modifications to Terms",
      content: [
        "BetMate reserves the right to modify these terms at any time. Continued use of the platform following notice of revisions constitutes acceptance.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
  ],
};

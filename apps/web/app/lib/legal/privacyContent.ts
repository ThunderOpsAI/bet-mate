export interface LegalSection {
  id: string;
  title: string;
  content: string[];
}

export interface PrivacyContent {
  title: string;
  subtitle: string;
  lastUpdated: string;
  version: string;
  summary: string;
  sections: LegalSection[];
}

export const privacyContent: PrivacyContent = {
  title: "Privacy Policy",
  subtitle: "How BetMate collects, uses, and safeguards your account and simulation data.",
  lastUpdated: "August 7, 2026",
  version: "1.0.0-draft",
  summary:
    "BetMate is committed to protecting your privacy. This policy outlines our data collection, processing, and storage practices for users of our quantitative paper-betting platform.",
  sections: [
    {
      id: "information-collection",
      title: "1. Information We Collect",
      content: [
        "Account Credentials: Username, email address, password hashes, and profile settings upon registration.",
        "Simulation & Strategy Activity: Paper bet history, virtual bankroll tracking, strategy lab configurations, and model feedback.",
        "Technical Metadata: IP address, browser agent, operating system details, and session tokens for security auditing.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
    {
      id: "how-we-use-information",
      title: "2. How We Use Your Information",
      content: [
        "To operate, personalize, and improve BetMate's paper-betting simulation features and analytics engines.",
        "To provide customer support, deliver system updates, and send security alerts.",
        "To detect and prevent fraudulent, abusive, or unauthorized platform interactions.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
    {
      id: "data-sharing",
      title: "3. Data Sharing & Disclosure",
      content: [
        "BetMate does not sell, trade, or rent personal user information to third-party advertisers.",
        "Data may be shared with trusted infrastructure providers (e.g. database host, cloud hosting) strictly under confidentiality obligations.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
    {
      id: "data-security",
      title: "4. Data Storage & Security",
      content: [
        "We employ industry-standard encryption protocols (TLS/SSL in transit, server-side encryption at rest) and strict access controls.",
        "Users are encouraged to maintain unique, secure passwords to safeguard their account access.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
    {
      id: "user-rights",
      title: "5. Your Rights & Data Portability",
      content: [
        "Users may request access to, correction of, or deletion of their personal information at any time.",
        "You can clear or reset your paper betting simulation metrics directly within account preferences.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
    {
      id: "policy-updates",
      title: "6. Changes to This Privacy Policy",
      content: [
        "We may update this Privacy Policy from time to time. Any material changes will be announced on our website.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
    {
      id: "contact-us",
      title: "7. Contact Us",
      content: [
        "If you have questions regarding this Privacy Policy or data privacy practices, please contact legal@betmate.ai.",
        "[PLACEHOLDER — TO BE FINALIZED]",
      ],
    },
  ],
};

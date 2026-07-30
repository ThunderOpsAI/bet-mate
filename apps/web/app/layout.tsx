import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { QueryProvider } from "./providers/QueryProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { PaperBetslipProvider } from "./providers/PaperBetslipProvider";
import AppShell from "./components/AppShell";

import { AnalyticsProvider } from "./components/analytics/AnalyticsProvider";

export const metadata: Metadata = {
  title: "BetMate — AI-Powered Multi-Sport Predictions",
  description: "XGBoost ML-powered predictions for racing, AFL, and NBA. Explainable AI insights, fair odds calculations, and feature importance analysis.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <AnalyticsProvider />
        <QueryProvider>
          <AuthProvider>
            <PaperBetslipProvider>
              <AppShell>{children}</AppShell>
            </PaperBetslipProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

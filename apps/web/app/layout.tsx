import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { QueryProvider } from "./providers/QueryProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { PaperBetslipProvider } from "./providers/PaperBetslipProvider";
import { MotionProvider } from "./providers/MotionProvider";
import AppShell from "./components/AppShell";

import { AnalyticsProvider } from "./components/analytics/AnalyticsProvider";

export const metadata: Metadata = {
  title: "BetMate — AI-Powered Multi-Sport Predictions",
  description:
    "XGBoost ML-powered predictions for racing, AFL, and NBA. Explainable AI insights, fair odds calculations, and feature importance analysis.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden">
        <AnalyticsProvider />
        <QueryProvider>
          <AuthProvider>
            <PaperBetslipProvider>
              <MotionProvider>
                <AppShell>{children}</AppShell>
              </MotionProvider>
            </PaperBetslipProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

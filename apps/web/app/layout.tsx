import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { QueryProvider } from "./providers/QueryProvider";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "BetMate — AI-Powered Multi-Sport Predictions",
  description: "XGBoost ML-powered predictions for racing, AFL, and NBA. Explainable AI insights, fair odds calculations, and feature importance analysis.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}

import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AuthProvider } from "./providers/AuthProvider";
import { QueryProvider } from "./providers/QueryProvider";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "BetMate — Racing Predictions & Bet Tracker",
  description: "AI-powered racing predictions, bet tracking, and bankroll management. Track your performance, not your transactions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

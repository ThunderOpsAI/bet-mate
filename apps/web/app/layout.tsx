import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { QueryProvider } from "./providers/QueryProvider";
import { AuthProvider } from "./providers/AuthProvider";
import AppShell from "./components/AppShell";

export const metadata: Metadata = {
  title: "BetMate | Sports Statistics and Recommendations",
  description: "Sports statistics, tracking, and recommendation tools for racing, AFL, and NBA.",
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

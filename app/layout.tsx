import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Incident Command", description: "Real-time incident triage dashboard" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

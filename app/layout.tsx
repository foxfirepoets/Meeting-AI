import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meeting-AI - Quiet meeting assistant",
  description: "A silent side-panel assistant for live meeting transcripts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quietline — Silent meeting assistant",
  description: "A demo-first meeting transcript companion.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Balkanza — Product Dashboard",
  description: "Product & growth analytics for Balkanza",
  // Private internal tool — keep it out of every search index.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

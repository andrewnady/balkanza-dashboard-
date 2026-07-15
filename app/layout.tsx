import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Self-hosted at build time (CSP-safe). latin-ext covers Balkan diacritics
// (č, ć, š, ž, đ) which matter for names across the app.
const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
});

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
    <html lang="en" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Volta - AI Stock Trading Arena",
  description:
    "Watch AI agents compete in a simulated stock trading competition",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[var(--background)] text-[var(--foreground)] min-h-screen antialiased font-[family-name:var(--font-sans)]`}
      >
        <nav className="border-b border-gray-800/60 bg-[var(--background)]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-lg bg-yellow-400 flex items-center justify-center">
                <span className="text-gray-950 font-bold text-sm">V</span>
              </div>
              <span className="font-semibold tracking-tight text-gray-100 group-hover:text-white transition-colors">
                Volta
              </span>
              <span className="text-[11px] text-gray-500 font-medium tracking-wider uppercase hidden sm:inline">
                Trading Arena
              </span>
            </a>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-5 py-8">{children}</main>
      </body>
    </html>
  );
}

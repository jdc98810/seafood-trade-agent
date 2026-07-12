import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "水産物貿易 書類確認AI Agent",
  description: "水産物国際貿易における書類確認・申請準備支援AI Agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="bg-slate-900 text-white">
          <div className="mx-auto max-w-7xl px-6 py-3 flex items-center gap-8">
            <Link href="/" className="font-bold text-lg tracking-wide">
              🐟 水産物貿易 書類確認AI Agent
            </Link>
            <nav className="flex gap-6 text-sm text-slate-300">
              <Link href="/" className="hover:text-white">
                ダッシュボード
              </Link>
              <Link href="/review" className="hover:text-white">
                人間確認センター
              </Link>
            </nav>
            <span className="ml-auto text-xs text-slate-400">
              Human-in-the-loop / 外部送信・行政申請は行いません
            </span>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}

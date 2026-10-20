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
  title: "JSM Ops Dashboard",
  description: "Monitoraggio operativo Jira Service Management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <header className="border-b bg-white px-6 py-4">
          <h1 className="text-lg font-semibold">JSM Ops Dashboard</h1>
          <p className="text-xs text-gray-500">Monitoraggio operativo — read-only sidecar</p>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </body>
    </html>
  );
}

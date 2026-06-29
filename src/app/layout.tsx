import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { NoZoom } from "@/components/no-zoom";
import { PwaRegister } from "@/components/pwa-register";
import { getInitialData } from "@/lib/initial-data";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Kubi",
  title: "Kubi",
  description: "Kid-friendly YouTube curation",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kubi",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-icon.png",
  },
};

export const viewport = {
  userScalable: false,
  themeColor: "#4f46e5",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, profiles } = await getInitialData();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NoZoom />
        <PwaRegister />
        <AppShell initialUser={user} initialProfiles={profiles}>
          {children}
        </AppShell>
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

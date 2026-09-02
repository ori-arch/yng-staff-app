import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSession } from "@/lib/session";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "YNG Staff",
  description: "YNG Aesthetics Lounge — staff daily operations app",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const session = getSession();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rufina:wght@400;700&family=Urbanist:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell
          session={
            session
              ? { name: session.name, role: session.role, isAdmin: session.isAdmin, isOwner: session.isOwner }
              : null
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}

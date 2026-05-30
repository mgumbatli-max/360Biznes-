import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToasterMount } from "@/components/providers/toaster-mount";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "360Biznes — Modern ERP/Anbar sistemi",
    template: "%s · 360Biznes",
  },
  description:
    "360Biznes — multi-tenant SaaS ERP. Anbar, satış, maliyyə, CRM, AI köməkçi və daha çoxu vahid platformada.",
  icons: { icon: "/favicon.ico" },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "360Biznes",
  },
};

// Mobil görünüş — themeColor, viewport-fit notch dəstəyi.
// userScalable: true (accessibility üçün zoom qalmalıdır — disable etmirik).
// interactiveWidget: "resizes-content" — klaviatura açılanda layout sıxlanır,
// bottom-nav və FAB klaviaturanın altında qalmır.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="az" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://public.blob.vercel-storage.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body className="min-h-full bg-background text-foreground font-sans">
        <ThemeProvider>
          {children}
          <ToasterMount />
        </ThemeProvider>
      </body>
    </html>
  );
}

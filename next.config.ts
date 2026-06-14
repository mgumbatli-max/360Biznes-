import type { NextConfig } from "next";
import path from "node:path";
import { withBotId } from "botid/next/config";

// Təhlükəsizlik başlıqları — bütün route-lara tətbiq olunur.
// CSP qəsdən 'unsafe-inline'/'unsafe-eval' saxlayır (inline style/script + WASM
// pozulmasın); xarici domendən script/connect inject etməyi isə bloklayır.
// Gələcək hardening: nonce-əsaslı strict CSP.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Server fingerprint-ini gizlət (X-Powered-By: Next.js başlığını sil)
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  // Network-level
  compress: true,
  productionBrowserSourceMaps: false,

  // Heavy native/server-only paketlər — Next bundler bunları client-ə daşımır,
  // server tərəfdə də require() ilə birbaşa node_modules-dən yüklənir
  // (RSC tree-walk məruz qalmır → daha sürətli rebuild + soyuq start).
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "@anthropic-ai/sdk",
    "exceljs",
    "pg",
    "pino",
    "pino-pretty",
  ],

  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Naviqasiya cache — geri/qabaq getmək instant, fresh data N saniyə sonra
    staleTimes: {
      dynamic: 30,    // dinamik səhifələr 30 saniyə cache
      static: 180,    // statik səhifələr 3 dəqiqə
    },
    // Next 16 View Transitions — səhifə dəyişikliklərində smooth animasiya
    viewTransition: true,
    // Tree-shake heavy paketlər — bundle ölçüsünü çox azaldır
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "radix-ui",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "recharts",
      "cmdk",
      "sonner",
    ],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};

// Vercel BotID — qeydiyyat formasını bot/credential-stuffing-dən qoruyur.
// withBotId challenge proxy rewrite-larını əlavə edir (same-origin → CSP 'self' uyğun).
export default withBotId(nextConfig);

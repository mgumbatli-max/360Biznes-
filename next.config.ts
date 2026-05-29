import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
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

export default nextConfig;

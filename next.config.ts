import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Network-level
  compress: true,
  productionBrowserSourceMaps: false,

  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
    // Naviqasiya cache — geri/qabaq getmək instant, fresh data N saniyə sonra
    staleTimes: {
      dynamic: 30,    // dinamik səhifələr 30 saniyə cache
      static: 180,    // statik səhifələr 3 dəqiqə
    },
    // Tree-shake heavy paketlər — bundle ölçüsünü çox azaldır
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "recharts",
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

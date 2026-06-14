/** @type {import('tailwindcss').Config} */
// LIGHT + DARK tema. Neytral tokenlərin dark variantı (dark: className ilə işlədilir).
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0d9488", dark: "#0a7860", light: "#ccfbf1", 50: "#f0fdfa" },
        ink: "#141820", sub: "#757a85", line: "#e5e5f0",
        card: "#ffffff", surface: "#f3f3f8",
        pos: "#10b981", neg: "#ef4444", warn: "#f59e0b", info: "#3b82f6",
        bg: "#f7f7fc",
        // Dark variantlar (dark:bg-cardDark, dark:text-inkDark və s.)
        cardDark: "#161c2b", bgDark: "#0b0f1a", inkDark: "#eef1f8",
        subDark: "#98a2b8", lineDark: "#2a3346", surfaceDark: "#1e2638",
      },
    },
  },
  plugins: [],
};

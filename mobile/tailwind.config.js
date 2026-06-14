/** @type {import('tailwindcss').Config} */
// LIGHT tema — 360biznes.az light tokenləri ilə uyğun.
module.exports = {
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
      },
    },
  },
  plugins: [],
};

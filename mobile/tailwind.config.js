/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0d9488", dark: "#0f766e", light: "#ccfbf1", 50: "#f0fdfa" },
        ink: "#0f172a", sub: "#64748b", line: "#eef0f4",
        pos: "#16a34a", neg: "#dc2626", warn: "#d97706", bg: "#f7f8fb",
      },
    },
  },
  plugins: [],
};

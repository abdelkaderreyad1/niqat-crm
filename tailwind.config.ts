import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#F08A24", dark: "#d6741a", soft: "#fff4e9" },
        ink: "#0F1B30",
        muted: "#6B7790",
        line: "#E2E7F0",
        green: "#18A957",
        amber: "#E6A700",
        red: "#E0483B",
        blue: "#2F6BFF",
        teal: "#0FA3A3",
        purple: "#7B61FF",
        wa: "#25D366",
      },
      fontFamily: {
        sans: ["Tajawal", "system-ui", "sans-serif"],
        num: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "14px" },
      boxShadow: { card: "0 1px 2px rgba(16,27,48,.06),0 6px 20px rgba(16,27,48,.06)" },
    },
  },
  plugins: [],
} satisfies Config;

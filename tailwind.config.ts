import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0E5FD8", dark: "#0a4aa8", soft: "#eef4ff" },
        ink: "#16202e", muted: "#5a6b80", line: "#e6ebf2"
      },
      fontFamily: { sans: ["Tajawal", "system-ui", "sans-serif"] }
    }
  },
  plugins: []
} satisfies Config;

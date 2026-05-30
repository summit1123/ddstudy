import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        muted: "#667085",
        line: "#DDE6F0",
        brand: {
          50: "#EFF8FF",
          100: "#D9EDFF",
          500: "#1677F2",
          600: "#0B65D8",
          700: "#064EA8"
        },
        mint: {
          50: "#EAFBF6",
          100: "#CCF4E8",
          500: "#17B890",
          600: "#079E92"
        }
      },
      boxShadow: {
        soft: "0 10px 28px rgba(16, 24, 40, 0.08)",
        lift: "0 18px 42px rgba(16, 24, 40, 0.12)"
      },
      borderRadius: {
        "2xl": "22px",
        "3xl": "30px"
      }
    }
  },
  plugins: []
};

export default config;

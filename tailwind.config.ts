import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        panel: "#111827",
        panel2: "#172033",
        line: "#263248",
        good: "#22c55e",
        bad: "#fb7185",
        warn: "#f59e0b",
        info: "#38bdf8"
      },
      boxShadow: {
        dashboard: "0 12px 40px rgba(0,0,0,0.28)"
      }
    }
  },
  plugins: []
};

export default config;

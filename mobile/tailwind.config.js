/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#7C3AED",
        "primary-dark": "#5B21B6",
        bg: "#0F0F13",
        surface: "#1A1A24",
        "surface-2": "#242432",
        border: "#2A2A3C",
        "text-primary": "#F0F0F5",
        "text-secondary": "#9090A8",
        "text-muted": "#5A5A6E",
        accent: {
          claude: "#D97706",
          openai: "#10B981",
          gemini: "#3B82F6",
        },
        error: "#EF4444",
        success: "#22C55E",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        6: "24px",
        8: "32px",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        full: "24px",
      },
      fontFamily: {
        sans: ["System", "sans-serif"],
      },
    },
  },
  plugins: [],
};

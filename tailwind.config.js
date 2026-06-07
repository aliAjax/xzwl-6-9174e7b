/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        oak: {
          50: "#F5F0E8",
          100: "#EFE7D9",
          200: "#D7CCC8",
          300: "#BCAAA4",
          400: "#A1887F",
          500: "#8D6E63",
          600: "#795548",
          700: "#6D4C41",
          800: "#5D4037",
          900: "#4E342E",
          950: "#3E2723",
        },
        moss: {
          50: "#F1F8E9",
          100: "#DCEDC8",
          200: "#C5E1A5",
          300: "#AED581",
          400: "#9CCC65",
          500: "#8BC34A",
          600: "#7CB342",
          700: "#689F38",
          800: "#558B2F",
          900: "#33691E",
        },
        rust: {
          50: "#FFF3E0",
          100: "#FFE0B2",
          200: "#FFCC80",
          300: "#FFB74D",
          400: "#FFA726",
          500: "#FF9800",
          600: "#FB8C00",
          700: "#F57C00",
          800: "#EF6C00",
          900: "#E65100",
        },
        parchment: {
          50: "#FAF7F0",
          100: "#F5F0E8",
          200: "#EFE7D9",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif CN"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
      boxShadow: {
        card: "0 2px 8px rgba(93, 64, 55, 0.08), 0 1px 3px rgba(93, 64, 55, 0.06)",
        hover: "0 8px 24px rgba(93, 64, 55, 0.12), 0 2px 8px rgba(93, 64, 55, 0.08)",
      },
      backgroundImage: {
        "parchment-texture": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        "scale-in": "scaleIn 0.3s ease-out forwards",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

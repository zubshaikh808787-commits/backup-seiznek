/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        seznik: {
          50: '#eef8ff',
          100: '#d8f0ff',
          200: '#b9e5ff',
          300: '#89d4ff',
          400: '#52b9ff',
          500: '#2a97ff',
          600: '#0066ff', // Core Primary Accent
          700: '#0052e0',
          800: '#0043b8',
          900: '#063b91',
          950: '#092458',
        },
        dark: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          hover: '#334155',
          text: '#f8fafc',
          muted: '#94a3b8',
        },
        light: {
          bg: '#f8fafc',
          card: '#ffffff',
          border: '#e2e8f0',
          hover: '#f1f5f9',
          text: '#0f172a',
          muted: '#64748b',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'fluent': '0 4px 20px -2px rgba(0, 0, 0, 0.25)',
        'fluent-glow': '0 0 25px rgba(0, 102, 255, 0.35)',
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
      }
    },
  },
  plugins: [],
}

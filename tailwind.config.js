/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        background: '#0b0b0b',
        foreground: '#f5f5f5',
        card: '#121212',
        border: '#242424',
        muted: '#1a1a1a',
        'muted-foreground': '#a3a3a3',
        accent: '#f97316',
        'accent-foreground': '#ffffff',
        input: '#151515',
        primary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
        },
        secondary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        'cto-purple': '#7c3aed',
        'cto-green': '#22c55e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-light': 'pulse-light 2s cubic-bezier(0.4, 0, 0.6, 1) 1',
      },
      keyframes: {
        'pulse-light': {
          '0%, 100%': { opacity: 1, borderColor: '#22c55e' },
          '50%': { opacity: 0.9, borderColor: '#4ade80', boxShadow: '0 0 8px rgba(74, 222, 128, 0.5)' },
        },
      },
    },
  },
  plugins: [],
}

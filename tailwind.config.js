/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        noir: {
          950: '#09090d',
          900: '#12121a',
          800: '#1c1c28',
          700: '#2a2a3c',
        },
        crimson: {
          500: '#e11d48',
          600: '#be123c',
          900: '#4c0519',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
};

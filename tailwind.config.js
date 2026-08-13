/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Brand accents. Overriding Tailwind's stock scales (instead of
        // hand-editing every amber-*/teal-* class) so every component
        // repaints consistently from one place -- see redesign 2026-08-13.
        amber: {
          50: '#f7ede7', 100: '#ecd2c3', 200: '#ddb094', 300: '#cc8d66',
          400: '#c2723f', 500: '#b3502f', 600: '#9a4527', 700: '#7d3720',
          800: '#5f2a19', 900: '#431d11', 950: '#2a1109',
        },
        teal: {
          50: '#eef2f0', 100: '#d3ddd7', 200: '#a9bdb2', 300: '#86a897',
          400: '#6b9080', 500: '#587566', 600: '#486253', 700: '#3f5a4a',
          800: '#2f463a', 900: '#21332a', 950: '#14211b',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}

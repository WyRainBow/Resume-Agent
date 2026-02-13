/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'Sora', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Menlo', 'monospace'],
      },
      colors: {
        panel: '#0D1A2B',
        neon: '#12B3FF',
        ink: '#09111D',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(18,179,255,0.35), 0 22px 42px rgba(9,17,29,0.35)',
      },
    },
  },
  plugins: [],
}

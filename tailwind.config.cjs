/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Redesign (2026) tokens - shared by the onboarding flow and the new
      // dashboard shell/Overview. Kept separate from the app's existing
      // arbitrary-value colors (e.g. bg-[#13111C]) since those pages haven't
      // been redesigned yet; this is the first of several phases moving the
      // whole app onto this palette.
      colors: {
        canvas: '#0e0d14',
        'canvas-2': '#0f0e16',
        surface: '#15141e',
        'surface-2': '#12111a',
        accent: {
          DEFAULT: '#6b7aff',
          hover: '#8794ff',
          soft: '#c3c9ff',
        },
        band: {
          red: '#f0655c',
          amber: '#e0a341',
          green: '#5ec089',
          blue: '#6b7aff',
        },
      },
      fontFamily: {
        archivo: ['Archivo', 'system-ui', 'sans-serif'],
        'mono-ibm': ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Graphite surface scale for the dark, minimal palette.
        graphite: {
          950: '#0a0c10',
          900: '#0e1116',
          850: '#12151c',
          800: '#171b23',
          700: '#1f242e',
          600: '#2a303c',
          500: '#3a4250',
          400: '#5b6472',
          300: '#8b95a5',
          200: '#aab3c2',
          100: '#d4d9e2',
          50: '#e8ecf3',
        },
        brand: {
          50: '#eaf1ff',
          300: '#8fb6ff',
          400: '#5a90ff',
          500: '#2f6bff',
          600: '#1f52e0',
          700: '#1a41b3',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: ['SFMono-Regular', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        palette: '0 24px 60px -12px rgba(0, 0, 0, 0.65)',
      },
      keyframes: {
        'palette-in': {
          '0%': { opacity: '0', transform: 'translateY(-6px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'palette-in': 'palette-in 120ms ease-out',
      },
    },
  },
  plugins: [],
};

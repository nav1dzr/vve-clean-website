/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4ff',
          500: '#1e4fa8',
          700: '#0a2a6e',
          900: '#04123a',
          950: '#020b24',
        },
        sky: {
          50: '#f0f9ff',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        silver: {
          100: '#f8f9fa',
          200: '#e9ecef',
          300: '#dee2e6',
          500: '#adb5bd',
          700: '#6c757d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4ff',
          100: '#dce6ff',
          200: '#b3c8ff',
          300: '#7aa3ff',
          400: '#4a7afc',
          500: '#1e4fa8',
          600: '#0f3a8c',
          700: '#0a2a6e',
          800: '#071d52',
          900: '#04123a',
          950: '#020b24',
          secondary: '#0B1F3A',
        },
        // Fresh sky-blue brand palette
        royal: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        sky: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        silver: {
          100: '#f8f9fa',
          200: '#e9ecef',
          300: '#dee2e6',
          400: '#ced4da',
          500: '#adb5bd',
          600: '#8d97a0',
          700: '#6c757d',
        },
        // VVE brand tokens (feat/visual-polish) — exact hex values from the
        // design spec. Additive only: existing navy/royal/silver scales above
        // are left in place (389+ call sites already reference them, and
        // navy-950/royal-500/royal-600 already match the spec exactly), so
        // nothing that already renders correctly needs to change.
        ink:     '#10243E', // main text
        muted:   '#5B6B7C', // secondary/muted text
        line:    '#DCE5EC', // borders/dividers
        surface: '#F7FAFC', // light section background
        success: '#15803D',
        error:   '#B42318',
      },
      fontFamily: {
        // Bricolage Grotesque is the single heading font (spec: "Remove
        // Playfair Display from active use if safe"). Redirecting the
        // `display` token here retypesets all 57+ existing font-display call
        // sites in one place, instead of touching every component.
        hero: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.7s ease-out forwards',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.8s ease-out forwards',
        'shimmer': 'shimmer 2s infinite linear',
        'float': 'float 3s ease-in-out infinite',
        'count-up': 'countUp 2s ease-out forwards',
        'marquee': 'marquee 40s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-40px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        marquee: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      backgroundImage: {
        'gradient-metallic': 'linear-gradient(135deg, #c8cdd6 0%, #e8eaed 30%, #b8bec8 50%, #e2e4e8 70%, #c0c6d0 100%)',
        'gradient-navy': 'linear-gradient(135deg, #04123a 0%, #071d52 50%, #0a2a6e 100%)',
        'gradient-royal': 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 60%, #38bdf8 100%)',
      },
    },
  },
  plugins: [],
};

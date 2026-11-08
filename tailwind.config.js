/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f1f8f3',
          100: '#dcefe2',
          200: '#b9dfc8',
          300: '#8cc9a5',
          400: '#56ad7d',
          500: '#2f9164',
          600: '#1f7550',
          700: '#1a5d42',
          800: '#174a36',
          900: '#133d2e',
        },
        accent: {
          50: '#fdf8ec',
          100: '#faefcc',
          200: '#f5dd98',
          300: '#eec55d',
          400: '#e6ab2f',
          500: '#cc8e1c',
          600: '#ad6e16',
          700: '#8a5216',
          800: '#71411a',
          900: '#5f381a',
        },
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-up': 'slide-up 220ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

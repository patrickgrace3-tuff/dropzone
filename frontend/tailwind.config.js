/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand:  '#FF4D1C',
        brand2: '#1C1C2E',
        accent: '#FFD166',
        live:   '#FF2D55',
        dz: {
          50:  '#FFF4F1',
          100: '#FFE4DC',
          500: '#FF4D1C',
          600: '#E03A0C',
          900: '#1C1C2E',
        },
      },
      fontFamily: {
        sans:  ['Syne', 'sans-serif'],
        mono:  ['DM Mono', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4,0,0.6,1) infinite',
        'bid-pop':    'bidPop 0.3s ease-out',
      },
      keyframes: {
        bidPop: { '0%': { transform: 'scale(1.2)', color: '#FF4D1C' }, '100%': { transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};

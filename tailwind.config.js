export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#0b1020',
        panel: '#111827',
        accent: '#22c55e',
        accentSoft: '#1d4ed8',
        gold: '#fbbf24',
        ink: '#e5eefb',
      },
      boxShadow: {
        soft: '0 18px 40px rgba(15, 23, 42, 0.18)',
      },
    },
  },
  plugins: [],
};

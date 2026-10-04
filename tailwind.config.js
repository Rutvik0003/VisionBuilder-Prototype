/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#5E1A47', light: '#F6EAF1', dark: '#48113A' },
        accent: { DEFAULT: '#F7941D', light: '#FEF1E0', dark: '#E07F0C' },
        success: '#038D63',
        warning: '#F59E0B',
        danger: '#D32F2F',
        ink: { DEFAULT: '#1F1F1F', muted: '#6B6B6B' },
        page: '#F5F5F7',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      fontSize: { base: '14px' },
      borderRadius: { card: '12px' },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'surface-strong': 'var(--surface-strong)',
        'on-surface': 'var(--on-surface)',
        accent: 'var(--accent)',
      },
    },
  },
  plugins: [],
};

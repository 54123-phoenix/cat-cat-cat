/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#F97316',
        'primary-hover': '#EA580C',
        'primary-light': '#FFF7ED',
        'warm-50': '#FFFBF5',
        'warm-100': '#FFF1E6',
        card: '#FFFFFF',
        text: '#1C1917',
        'text-secondary': '#78716C',
        'text-muted': '#A8A29E',
        success: '#22C55E',
        border: '#E7E5E4',
        'border-light': '#F5F5F4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        'elevated': '0 10px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      borderWidth: {
        3: '3px',
      },
      scale: {
        97: '0.97',
      },
      colors: {
        cat: {
          orange: '#F97316',
          'orange-lt': '#FED7AA',
          warm: '#FEF3E8',
          cream: '#FFFBF5',
        },
        primary: 'oklch(70% 0.18 45)',
        'primary-light': 'oklch(85% 0.1 45)',
        bg: 'oklch(98% 0.005 80)',
        card: 'oklch(99% 0.005 80)',
        text: 'oklch(25% 0.02 50)',
        'text-secondary': 'oklch(55% 0.02 50)',
        success: 'oklch(72% 0.15 160)',
        border: 'oklch(90% 0.01 80)',
      },
      fontFamily: {
        display: ['"Varela Round"', 'sans-serif'],
        body: ['"Nunito Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

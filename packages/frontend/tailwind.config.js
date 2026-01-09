/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', 
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        salvaGold: '#D4AF37', 
        salvaDark: '#0A0A0B',
      },
      animation: {
        'float-slow': 'float 8s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-30px) rotate(10deg)' },
        }
      }
    },
  },
  plugins: [],
}
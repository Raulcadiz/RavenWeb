/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          750: '#2d3748',
          850: '#1a202e',
          950: '#0f1419',
        }
      },
      animation: {
        'gradient': 'gradient 3s ease infinite',
        'fadeIn': 'fadeIn 0.5s ease-out',
        'slideIn': 'slideIn 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
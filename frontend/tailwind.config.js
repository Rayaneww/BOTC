/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0d0d14',
        'bg-secondary': '#1a1a2e',
        'bg-card': '#16213e',
        'accent-red': '#c41e3a',
        'accent-gold': '#d4af37',
        'text-primary': '#e8e8e8',
        'text-secondary': '#a0a0a0',
        'border-color': '#2a2a4a',
        // Types de rôles
        'role-citadin': '#4a90d9',
        'role-sbire': '#9b59b6',
        'role-demon': '#c41e3a',
        'role-etranger': '#27ae60',
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px #c41e3a, 0 0 10px #c41e3a' },
          '100%': { boxShadow: '0 0 10px #c41e3a, 0 0 20px #c41e3a, 0 0 30px #c41e3a' },
        },
      },
    },
  },
  plugins: [],
};

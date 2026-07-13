/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './assets/app.js'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#f5f5f7',
        foreground: '#1d1d1f',
        card: 'rgba(255, 255, 255, 0.8)',
        'card-foreground': '#1d1d1f',
        primary: '#007AFF',
        'primary-foreground': '#ffffff',
        secondary: 'rgba(142, 142, 147, 0.12)',
        'secondary-foreground': '#1d1d1f',
        muted: 'rgba(142, 142, 147, 0.12)',
        'muted-foreground': '#8e8e93',
        border: 'rgba(0, 0, 0, 0.1)',
        input: 'rgba(255, 255, 255, 0.9)',
        ring: '#007AFF'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif']
      },
      borderRadius: {
        ios: '20px',
        'ios-sm': '12px',
        'ios-lg': '28px'
      },
      boxShadow: {
        ios: '0 2px 10px rgba(0, 0, 0, 0.1), 0 0 1px rgba(0, 0, 0, 0.1)',
        'ios-lg': '0 10px 40px rgba(0, 0, 0, 0.15), 0 0 1px rgba(0, 0, 0, 0.1)',
        'ios-card': '0 4px 16px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.08)'
      }
    }
  },
  plugins: []
};

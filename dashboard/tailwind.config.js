/** Tokens de diseño: paleta inspirada en la NFL + colores de equipo (solo para distinguir equipos). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Inter', 'Arial Narrow', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      colors: {
        // Mismos valores que las variables CSS de src/index.css (hex para permitir /opacidad)
        nfl: { navy: '#013369', red: '#D50A0A', dark: '#001A38', light: '#F2F5F9', border: '#C8D1DC' },
        vikings: { purple: '#4F2683', gold: '#FFC62F' },
        niners: { red: '#AA0000', gold: '#B3995D' },
      },
      keyframes: {
        rueda: { '0%': { transform: 'translateY(0)', opacity: '1' }, '75%': { transform: 'translateY(9px)', opacity: '0' }, '100%': { opacity: '0' } },
        sube: { '0%': { backgroundColor: 'rgba(16,185,129,.45)' }, '100%': { backgroundColor: 'transparent' } },
        baja: { '0%': { backgroundColor: 'rgba(213,10,10,.5)' }, '100%': { backgroundColor: 'transparent' } },
      },
      animation: { rueda: 'rueda 1.7s infinite ease-in-out', sube: 'sube 1.4s ease-out', baja: 'baja 1.4s ease-out' },
    },
  },
  plugins: [],
}

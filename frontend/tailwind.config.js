/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#091929',
          900: '#0F2A43', // Deep navy sidebar
          800: '#163B5D',
          700: '#1F4F7C',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          bg: '#F4F7FA', // Soft grey background
          subtle: '#EEF2F6',
          border: '#E2E8F0',
        },
        teal: {
          50: '#F0FDFE',
          100: '#CCF7FA',
          500: '#0E9AA7', // Teal primary
          600: '#0C838E',
          700: '#0A6972',
        },
        amber: {
          50: '#FFFBEB',
          500: '#F5A524', // Amber warning
          600: '#D98912',
        },
        critical: {
          50: '#FEF2F2',
          500: '#D64545', // Red critical
          600: '#B83232',
        },
        compliant: {
          50: '#F0FDF4',
          500: '#2E9E6B', // Green compliant
          600: '#248358',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 42, 67, 0.06), 0 1px 2px rgba(15, 42, 67, 0.04)',
        hover: '0 4px 6px -1px rgba(15, 42, 67, 0.08), 0 2px 4px -1px rgba(15, 42, 67, 0.04)',
      }
    },
  },
  plugins: [],
}

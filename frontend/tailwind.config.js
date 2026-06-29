/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        bone:        'oklch(0.94 0.012 90)',
        ink:         'oklch(0.16 0.005 60)',
        field:       'oklch(0.42 0.11 145)',
        'field-deep':'oklch(0.30 0.09 145)',
        concrete:    'oklch(0.82 0.008 90)',
        up:          'oklch(0.55 0.16 145)',
        down:        'oklch(0.55 0.18 28)',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
      },
    },
  },
  plugins: [],
}

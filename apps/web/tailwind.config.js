/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base':     'var(--bg-base)',
        'bg-surface':  'var(--bg-surface)',
        'fg-primary':  'var(--fg-primary)',
        'fg-muted':    'var(--fg-muted)',
        'fg-faint':    'var(--fg-faint)',
        leaf:          'var(--leaf)',
        'leaf-soft':   'var(--leaf-soft)',
        soil:          'var(--soil)',
        bloom:         'var(--bloom)',
        'bloom-soft':  'var(--bloom-soft)',
        sky:           'var(--sky)',
        'sky-soft':    'var(--sky-soft)',
        wither:        'var(--wither)',
        danger:        'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm:      'var(--radius-sm)',
        lg:      'var(--radius-lg)',
        full:    'var(--radius-full)',
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

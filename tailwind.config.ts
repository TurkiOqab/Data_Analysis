import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg))',
        panel: 'hsl(var(--panel))',
        'panel-2': 'hsl(var(--panel-2))',
        line: 'hsl(var(--line))',
        'line-soft': 'hsl(var(--line-soft))',
        ink: 'hsl(var(--ink))',
        'ink-soft': 'hsl(var(--ink-soft))',
        muted: 'hsl(var(--muted))',
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          strong: 'hsl(var(--accent-strong))',
          tint: 'hsl(var(--accent-tint))',
        },
        good: 'hsl(var(--good))',
        // shadcn aliases (so primitives installed in Task 3 just work)
        background: 'hsl(var(--bg))',
        foreground: 'hsl(var(--ink))',
        border: 'hsl(var(--line))',
        input: 'hsl(var(--line))',
        ring: 'hsl(var(--accent))',
        primary: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(220 30% 6%)' },
        secondary: { DEFAULT: 'hsl(var(--panel-2))', foreground: 'hsl(var(--ink))' },
        destructive: { DEFAULT: 'hsl(0 70% 55%)', foreground: 'hsl(0 0% 100%)' },
        card: { DEFAULT: 'hsl(var(--panel))', foreground: 'hsl(var(--ink))' },
        popover: { DEFAULT: 'hsl(var(--panel))', foreground: 'hsl(var(--ink))' },
      },
      borderRadius: { lg: '12px', md: '10px', sm: '8px' },
    },
  },
  plugins: [animate],
} satisfies Config;

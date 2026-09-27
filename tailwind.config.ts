import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        puma: {
          900: '#0b1f3a',
          700: '#123a6d',
          500: '#1f6fd6',
          300: '#7db3f0',
          gold: '#f5b942',
        },
      },
    },
  },
  plugins: [],
};

export default config;

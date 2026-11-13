module.exports = {
  content: ['./index.html', './App.tsx', './components/**/*.{ts,tsx}', './views/**/*.{ts,tsx}'],
  safelist: [
    { pattern: /bg-(lime|zinc|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(100|200|300|400|500|600|700|800|900)/ },
  ],
  theme: { extend: {} },
  plugins: [],
};

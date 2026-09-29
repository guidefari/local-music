import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  root: 'src',
  base: './',
  plugins: [solid(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: false,
  },
})

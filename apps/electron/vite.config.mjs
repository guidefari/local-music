import { defineConfig } from "vite"
import tailwindcss from "@tailwindcss/vite"
import solid from "vite-plugin-solid"

export default defineConfig({
  root: "src",
  base: "./",
  plugins: [solid(), tailwindcss()],
  build: {
    outDir: "../dist",
    emptyOutDir: false,
  },
})

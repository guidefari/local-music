import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/implementation/main/db/schema.ts',
  out: './drizzle',
})

import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  base: process.env['BASE_URL'] ?? '/',
})

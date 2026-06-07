import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:3001', ws: true }
    }
  }
})

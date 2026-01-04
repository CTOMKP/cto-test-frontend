import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    'components': resolve(__dirname, 'src/components'),
      'services': resolve(__dirname, 'src/services'),
      'lib': resolve(__dirname, 'src/lib'),
      'app': resolve(__dirname, 'src/app'),
    }
  }
})

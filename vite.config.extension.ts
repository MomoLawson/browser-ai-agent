import { defineConfig } from 'vite'
import { resolve } from 'path'
import fs from 'fs'

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  build: {
    outDir: 'dist-extension',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, process.env.EXT_ENTRY || 'src/content/index.ts'),
      output: { format: 'iife', entryFileNames: '[name].js' },
    },
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        fs.copyFileSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist-extension/manifest.json'))
      },
    },
  ],
})

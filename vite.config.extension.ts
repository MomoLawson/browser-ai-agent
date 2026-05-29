import { defineConfig } from 'vite'
import { resolve } from 'path'
import fs from 'fs'

// Chrome Extension 构建配置
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist-extension',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  plugins: [
    // 复制 manifest.json 到输出目录
    {
      name: 'copy-manifest',
      closeBundle() {
        const src = resolve(__dirname, 'manifest.json')
        const dest = resolve(__dirname, 'dist-extension/manifest.json')
        fs.copyFileSync(src, dest)
        console.log('[ext] manifest.json copied')
      },
    },
  ],
})

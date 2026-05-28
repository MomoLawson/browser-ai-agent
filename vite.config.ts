import { defineConfig } from 'vite'
import monkey from 'vite-plugin-monkey'
import { resolve } from 'path'

// https://github.com/lisonge/vite-plugin-monkey
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    monkey({
      // Userscript 入口（也是内容脚本的核心）
      entry: 'src/content/index.ts',
      userscript: {
        name: 'Browser AI Agent',
        namespace: 'https://github.com/MomoLawson/browser-ai-agent',
        version: '0.1.0',
        description: '在 AI 网站上选择本地项目文件夹并运行 Agent 操作',
        author: 'MomoLawson',
        match: [
          'https://chatgpt.com/*',
          'https://chat.openai.com/*',
          'https://claude.ai/*',
          'https://gemini.google.com/*',
          'https://chat.deepseek.com/*',
          'https://kimi.moonshot.cn/*',
          'https://www.doubao.com/*',
          'https://yuanbao.tencent.com/*',
        ],
        grant: [
          'GM_getValue',
          'GM_setValue',
          'GM_deleteValue',
          'GM_listValues',
          'GM_addStyle',
          'GM_addElement',
          'GM_xmlhttpRequest',
        ],
        connect: [
          '*',
        ],
        require: [
          'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/js/all.min.js',
        ],
        runAt: 'document-end',
        noframes: true,
      },
      build: {
        // Userscript 输出文件名
        fileName: 'browser-ai-agent.user.js',
        // 同时输出 Chrome Extension（MV3）
        externalGlobals: {},
      },
    }),
  ],
})

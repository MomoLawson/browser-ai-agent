# Browser AI Agent / 浏览器 AI Agent

Turn any AI chat website into an AI programming agent. Select a local project folder, and let the AI read and modify your files — just like opencode or Claude Code, but in the browser.

把任意 AI 聊天网站变成 AI 编程助手。选择本地项目文件夹，AI 就能直接读取和修改你的文件——类似 opencode 或 Claude Code，但在浏览器里运行。

---

## Quick Start / 快速开始

### Userscript (recommended / 推荐)

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Build: `npm run build`
3. Drag `dist/browser-ai-agent.user.js` into the extension manager
4. Open any supported AI site — the 🤖 trigger appears at bottom-right

### Chrome Extension

```bash
npm run build:extension
# Load dist-extension/ as an unpacked extension in Chrome
```

## Supported Platforms / 支持的平台

| Platform | Domain | Status |
|----------|--------|--------|
| ChatGPT | chatgpt.com | ✅ |
| Claude | claude.ai | ✅ |
| Gemini | gemini.google.com | ✅ |
| DeepSeek | chat.deepseek.com | ✅ |
| Kimi | kimi.moonshot.cn | ✅ |
| 豆包 | doubao.com | ✅ |
| 元宝 | yuanbao.tencent.com | ✅ |

## How It Works / 工作原理

```
1. Open any AI chat site → 🤖 button appears at bottom-right
2. Click 🤖 → Agent panel opens → Select a local project folder
3. Copy the system prompt → Paste into chat → Send to AI
4. Talk to AI normally. AI uses tool tags to operate files:

   [list]              → Agent lists project files
   [read: path]        → Agent reads file, injects content
   [edit: path]        → Agent safely edits file (must match old content)
   old_code
   ====
   new_code
   [/edit]
   [write: path]       → Agent creates a new file
   content
   [/write]

5. Agent automatically executes tools and sends results back to AI
```

## Architecture / 架构

```
src/
├── content/          # Content script (userscript entry)
│   ├── index.ts      # Main: detect → inject → Agent execution
│   ├── agentLoop.ts  # Core Agent loop (monitor conversation, detect tools)
│   ├── fileSystem.ts # File System Access API wrapper
│   ├── injectUtils.ts # Multi-strategy input filling
│   ├── platforms/    # 7 AI platform DOM adapters
│   └── ui/           # Agent panel + trigger button UI
├── shared/           # Types, constants, cross-platform storage/messaging
├── background/       # Chrome Extension Service Worker
├── popup/            # Chrome Extension popup
└── userscript/       # Userscript wrapper
```

## Tech Stack / 技术栈

- **Vite + vite-plugin-monkey** — Single source → Userscript + Chrome Extension
- **File System Access API** — Native browser file read/write
- **Shadow DOM** — Style isolation from host page
- **TypeScript** — Fully typed

## Build / 构建

```bash
npm install
npm run build          # → dist/browser-ai-agent.user.js
npm run build:extension # → dist-extension/ (Chrome Extension)
```

## License

MIT

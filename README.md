# Browser AI Agent

> [简体中文](README.zh-Hans.md)

Turn any AI chat website into an AI programming agent. Select a local project folder, and let the AI read and modify your files — just like opencode or Claude Code, but in the browser.

---

## Quick Start

### Userscript (recommended)

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Build: `npm run build`
3. Drag `dist/browser-ai-agent.user.js` into the extension manager
4. Open any supported AI site — the 🤖 trigger appears at bottom-right

### Chrome Extension

```bash
npm run build:extension
# Load dist-extension/ as an unpacked extension in Chrome
```

## Supported Platforms

| Platform | Domain | Status |
|----------|--------|--------|
| ChatGPT | chatgpt.com | ✅ |
| Claude | claude.ai | ✅ |
| Gemini | gemini.google.com | ✅ |
| DeepSeek | chat.deepseek.com | ✅ |
| Kimi | kimi.moonshot.cn | ✅ |
| 豆包 | doubao.com | ✅ |
| 元宝 | yuanbao.tencent.com | ✅ |

## How It Works

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

## Architecture

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

## Tech Stack

- **Vite + vite-plugin-monkey** — Single source → Userscript + Chrome Extension
- **File System Access API** — Native browser file read/write
- **Shadow DOM** — Style isolation from host page
- **TypeScript** — Fully typed

## Build

```bash
npm install
npm run build          # → dist/browser-ai-agent.user.js
npm run build:extension # → dist-extension/ (Chrome Extension)
```

## Acknowledgments

This project draws significant inspiration from [opencode](https://github.com/anomalyco/opencode), particularly its:
- Core architecture and agent loop design
- File system abstraction patterns
- Tool description format (`edit.txt`, `read.txt`, `write.txt`, etc.)
- Multi-strategy text replacement engine (9 replacer strategies for robust edit matching)
- Clean prompt design and tool usage patterns

## License

MIT

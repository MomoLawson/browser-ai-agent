# Browser AI Agent

在 AI 聊天网站上选择本地项目文件夹，直接读取和修改文件。

## 快速开始

### Userscript 模式（推荐）

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)
2. 构建：`npm run build`
3. 将 `dist/browser-ai-agent.user.js` 拖入浏览器扩展管理页面
4. 打开任意支持的 AI 网站，页面底部会出现 Agent 控制面板

### Chrome Extension 模式

```bash
npm run build
# 在 Chrome 中加载 dist/ 目录作为未打包扩展
```

## 构建

```bash
npm install
npm run build   # 产出 dist/browser-ai-agent.user.js
```

## 支持的 AI 平台

| 平台 | 域名 | 适配器状态 |
|------|------|-----------|
| ChatGPT | chatgpt.com | ✅ |
| Claude | claude.ai | ✅ |
| Gemini | gemini.google.com | ✅ |
| DeepSeek | chat.deepseek.com | ✅ |
| Kimi | kimi.moonshot.cn | ✅ |
| 豆包 | doubao.com | ✅ |
| 元宝 | yuanbao.tencent.com | ✅ |

## 指令说明

在 Agent 面板的输入框中输入指令：

- `list` — 列出项目中的所有文件
- `read src/index.ts` — 读取指定文件内容并注入到聊天输入框
- `write src/test.ts: 文件内容` — 写入内容到指定文件

## 架构

```
src/
├── content/          # 内容脚本（Userscript 入口）
│   ├── index.ts      # 主入口：检测 → 注入 → Agent 执行
│   ├── fileSystem.ts # File System Access API 封装
│   ├── platforms/    # 7 个 AI 平台的 DOM 适配器
│   └── ui/           # Agent 控制面板 UI
├── shared/           # 类型、常量、跨平台存储/通信
├── background/       # Chrome Extension Service Worker
├── popup/            # Chrome Extension 弹窗
└── userscript/       # Userscript 包装
```

## 技术栈

- **Vite + vite-plugin-monkey** — 单一源码输出 Userscript + Chrome Extension
- **File System Access API** — 浏览器原生文件读写
- **Shadow DOM** — 与宿主页样式隔离
- **TypeScript** — 全量类型标注

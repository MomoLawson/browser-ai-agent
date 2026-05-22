# Browser AI Agent

> [English](README.md)

把任意 AI 聊天网站变成 AI 编程助手。选择本地项目文件夹，AI 就能直接读取和修改你的文件——类似 opencode 或 Claude Code，但在浏览器里运行。

---

## 快速开始

### Userscript 模式（推荐）

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)
2. 构建：`npm run build`
3. 将 `dist/browser-ai-agent.user.js` 拖入扩展管理器
4. 打开任意支持的 AI 网站 — 右下角出现 🤖 按钮

### Chrome Extension

```bash
npm run build:extension
# 在 Chrome 扩展管理页面加载 dist-extension/ 目录
```

## 支持的平台

| 平台 | 域名 | 状态 |
|------|------|------|
| ChatGPT | chatgpt.com | ✅ |
| Claude | claude.ai | ✅ |
| Gemini | gemini.google.com | ✅ |
| DeepSeek | chat.deepseek.com | ✅ |
| Kimi | kimi.moonshot.cn | ✅ |
| 豆包 | doubao.com | ✅ |
| 元宝 | yuanbao.tencent.com | ✅ |

## 工作原理

```
1. 打开任意 AI 网站 → 右下角出现 🤖
2. 点击 🤖 → 打开 Agent 面板 → 选择本地项目文件夹
3. 复制提示词 → 粘贴到聊天 → 发送给 AI
4. 正常和 AI 对话，AI 使用工具标签操作文件：

   [list]              → Agent 列出项目文件
   [read: 路径]        → Agent 读取文件内容并注入
   [edit: 路径]        → Agent 安全编辑文件（需匹配原始内容）
   原始代码
   ====
   新代码
   [/edit]
   [write: 路径]       → Agent 创建新文件
   文件内容
   [/write]

5. Agent 自动执行工具并将结果返回给 AI
```

## 架构

```
src/
├── content/          # 内容脚本（userscript 入口）
│   ├── index.ts      # 主入口：检测 → 注入 → Agent 执行
│   ├── agentLoop.ts  # Agent 核心循环（监听对话、检测工具）
│   ├── fileSystem.ts # File System Access API 封装
│   ├── injectUtils.ts # 多策略输入框填充
│   ├── platforms/    # 7 个 AI 平台的 DOM 适配器
│   └── ui/           # Agent 面板 + 触发按钮 UI
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

## 构建

```bash
npm install
npm run build          # → dist/browser-ai-agent.user.js
npm run build:extension # → dist-extension/ (Chrome Extension)
```

## 开源协议

MIT

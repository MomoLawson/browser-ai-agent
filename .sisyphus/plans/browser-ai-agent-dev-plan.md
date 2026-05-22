# Browser AI Agent - 浏览器扩展开发计划

## 1. 项目概述

### 1.1 项目目标
构建一个跨浏览器扩展，能够在主流 AI 网站（DeepSeek、ChatGPT、Gemini、Claude 等）上加载，让用户选择本地文件夹作为项目目录，并运行 Agent 操作。

### 1.2 技术选型

| 层级 | 选择 | 理由 |
|------|------|------|
| **构建工具** | **Vite** | 快速 HMR，插件生态丰富 |
| **打包策略** | **vite-plugin-monkey** | 一套代码同时输出 Chrome Extension + Userscript，极低成本维护两个分发渠道 |
| **语言** | **TypeScript** | 类型安全，工程化标准 |
| **UI 框架** | **Vanilla JS / Lit** | 浏览器扩展需要轻量，避免引入 React/Vue 带来的包体积问题；如需要复杂 UI 可选 Lit（~5kB） |
| **样式** | Shadow DOM + CSS | 与宿主页样式隔离，避免污染 |
| **通信** | `chrome.runtime.sendMessage` / `window.postMessage` | 扩展内部 + 跨上下文通信 |
| **文件系统** | **File System Access API** (`showDirectoryPicker`) | 原生浏览器 API，用户授权后可直接读写本地文件夹 |

### 1.3 关键约束
- 所有代码**必须同时兼容**：Chrome Extension MV3 + Userscript (Tampermonkey/Violentmonkey)
- 使用 `vite-plugin-monkey` 实现单一源码多输出
- 适配七大 AI 平台：ChatGPT (chatgpt.com)、Claude (claude.ai)、Gemini (gemini.google.com)、DeepSeek (chat.deepseek.com)、Kimi (kimi.moonshot.cn)、豆包 (doubao.com)、元宝 (yuanbao.tencent.com)
- 开源协议：MIT

### 1.4 项目结构（计划）

```
browser-ai-agent/
├── .sisyphus/                  # AI Agent 工作目录
├── src/
│   ├── content/                # 内容脚本 - 注入 AI 网站的代码
│   │   ├── index.ts            # 主入口 - 按域名分发
│   │   ├── platforms/          # 各 AI 平台适配器
│   │   │   ├── chatgpt.ts
│   │   │   ├── claude.ts
│   │   │   ├── gemini.ts
│   │   │   ├── deepseek.ts
│   │   │   ├── kimi.ts
│   │   │   ├── doubao.ts
│   │   │   └── yuanbao.ts
│   │   └── ui/                 # 注入的 UI 组件
│   │       ├── ProjectSelector.ts
│   │       ├── AgentPanel.ts
│   │       └── styles.ts
│   ├── background/             # 后台脚本 (Service Worker)
│   │   ├── index.ts
│   │   ├── fileSystem.ts       # 文件系统操作封装
│   │   └── agentRunner.ts      # Agent 执行引擎
│   ├── popup/                  # 弹窗页面
│   │   ├── index.html
│   │   └── popup.ts
│   ├── options/                # 设置页面
│   │   ├── index.html
│   │   └── options.ts
│   ├── shared/                 # 共享代码
│   │   ├── types.ts            # 类型定义
│   │   ├── constants.ts        # 常量
│   │   ├── storage.ts          # 跨平台存储抽象层
│   │   └── messaging.ts        # 消息通信协议
│   └── userscript/             # Userscript 专有入口
│       └── wrapper.ts
├── public/
│   └── icons/                  # 扩展图标
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 2. 开发阶段

### Phase 0: 项目初始化与基础设施

**预估工时：1-2 天**

#### 2.0.1 初始化项目
- [ ] `npm init` 创建 package.json
- [ ] 配置 TypeScript (`tsconfig.json`)
- [ ] 配置 Vite + `vite-plugin-monkey`
- [ ] 创建目录结构骨架
- [ ] 配置 ESLint / Prettier

#### 2.0.2 vite-plugin-monkey 配置

```typescript
// vite.config.ts 核心配置
import monkey from 'vite-plugin-monkey'

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/content/index.ts',
      userscript: {
        name: 'Browser AI Agent',
        namespace: 'https://github.com/MomoLawson/browser-ai-agent',
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
          'GM_addStyle',
          'GM_addElement',
          'GM_xmlhttpRequest',
        ],
        runAt: 'document-end',
      },
      build: {
        // Userscript 输出
        fileName: 'browser-ai-agent.user.js',
      },
    }),
    // 同时输出 Chrome Extension 配置
  ],
})
```

#### 2.0.3 Chrome Extension Manifest V3

```json
{
  "manifest_version": 3,
  "name": "Browser AI Agent",
  "version": "0.1.0",
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://chat.deepseek.com/*",
    "https://kimi.moonshot.cn/*",
    "https://www.doubao.com/*",
    "https://yuanbao.tencent.com/*"
  ],
  "content_scripts": [{
    "matches": [
      "https://chatgpt.com/*",
      "https://chat.openai.com/*",
      "https://claude.ai/*",
      "https://gemini.google.com/*",
      "https://chat.deepseek.com/*",
      "https://kimi.moonshot.cn/*",
      "https://www.doubao.com/*"
    ],
    "js": ["content/index.global.js"],
    "run_at": "document_end"
  }],
  "background": {
    "service_worker": "background/index.js"
  },
  "action": {
    "default_popup": "popup/index.html"
  }
}
```

> **关键决策**: 使用 `vite-plugin-monkey` 的 dual-build 模式，一次构建同时产出 `browser-ai-agent.user.js`（Userscript）和 Chrome Extension 包。

---

### Phase 1: AI 平台适配器（核心注入层）

**预估工时：3-4 天**

#### 2.1.1 平台检测引擎

```typescript
// src/content/platforms/detector.ts
type AIPlatform = 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'kimi' | 'doubao' | 'yuanbao'

function detectPlatform(): AIPlatform | null {
  const host = location.hostname
  if (host.includes('chatgpt.com') || host.includes('chat.openai.com')) return 'chatgpt'
  if (host.includes('claude.ai')) return 'claude'
  if (host.includes('gemini.google.com')) return 'gemini'
  if (host.includes('chat.deepseek.com')) return 'deepseek'
  if (host.includes('kimi.moonshot.cn')) return 'kimi'
  if (host.includes('doubao.com')) return 'doubao'
  if (host.includes('yuanbao.tencent.com')) return 'yuanbao'
  return null
}
```

#### 2.1.2 平台适配器接口

```typescript
// src/content/platforms/base.ts
interface PlatformAdapter {
  name: AIPlatform
  // 注入 Agent 控制面板到页面
  injectUI(): void
  // 获取当前对话内容
  getConversation(): Promise<Conversation>
  // 向输入框写入内容
  setInput(text: string): Promise<void>
  // 触发发送
  sendMessage(): Promise<void>
  // 监听页面变化（SPA 路由变化等）
  observe(): () => void  // 返回 cleanup 函数
}
```

#### 2.1.3 各平台 DOM 选择器参考（来自已有开源研究成果）

| 平台 | 输入框选择器 | 消息容器 | AI 响应选择器 |
|------|-------------|---------|-------------|
| **ChatGPT** | `#prompt-textarea`, `div[contenteditable="true"][data-id]` | `main[role="main"]` | `[data-message-author-role="assistant"]` |
| **Claude** | `div[contenteditable="true"]` | `div.font-claude-message` | `.font-claude-response`, `[data-testid="ai-message"]` |
| **Gemini** | `div[contenteditable="true"]`, `ms-autosize-textarea` | `ms-chat-turn` | `.model-response`, `[data-test-id="model-response"]` |
| **DeepSeek** | `textarea#chat-input`, `textarea[placeholder*='DeepSeek']` | `.ds-markdown` | `[data-message-author-role="assistant"]` |
| **Kimi** | 待逆向分析 | 待逆向分析 | 待逆向分析 |
| **豆包** | 待逆向分析 | 待逆向分析 | 待逆向分析 |

**注意**: Kimi 和豆包的选择器需要在 Phase 1 中通过 DevTools 实际分析确定。上述选择器来源于已有研究成果（Glassbox、chat-archive、DeepSeek Chat Advanced 等项目），但部分可能随平台更新而过时。

#### 2.1.4 UI 注入策略

使用 **Shadow DOM** 避免样式冲突：
```typescript
function createShadowHost(container: Element): ShadowRoot {
  const host = document.createElement('div')
  host.id = 'browser-ai-agent-container'
  container.appendChild(host)
  return host.attachShadow({ mode: 'closed' })
}
```

注入位置策略（各平台不同）：
- **ChatGPT**: 输入框右侧或下方
- **Claude**: 输入框区域
- **Gemini**: 底部工具栏区域
- **DeepSeek**: 输入框附近或侧边栏底部
- **Kimi**: 侧边栏底部（`.sidebar-footer`）或输入框上方
- **豆包**: 侧边栏底部（`.left-side-*` 区域）或输入框上方
- **元宝**: 输入框工具栏区域或导航栏区域
- 使用 `MutationObserver` 监听 DOM 变化，自动重新注入

---

### Phase 2: 文件系统操作

**预估工时：2-3 天**

#### 2.2.1 File System Access API (Chrome 86+)

```typescript
// src/background/fileSystem.ts

// 用户选择项目文件夹
async function selectProjectFolder(): Promise<FileSystemDirectoryHandle | null> {
  // Chrome 扩展中需在 popup 或 offscreen 页面中调用
  // 通过 message 传递 handle 到 background
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  // 持久化 handle 到 IndexedDB
  await saveDirectoryHandle(handle)
  return handle
}

// 将 handle 序列化存储（chrome 扩展可存为 native handle）
async function saveDirectoryHandle(handle: FileSystemDirectoryHandle) {
  // Chrome: 使用 chrome.storage.local + IndexedDB 备份
  // Userscript: 使用 GM_setValue 存储 handle 的 name/ID
}

// 递归读取目录结构
async function readDirectoryStructure(
  dirHandle: FileSystemDirectoryHandle,
  path: string = ''
): Promise<FileEntry[]> {
  const entries: FileEntry[] = []
  for await (const entry of dirHandle.values()) {
    const fullPath = path ? `${path}/${entry.name}` : entry.name
    if (entry.kind === 'file') {
      entries.push({ name: entry.name, path: fullPath, kind: 'file' })
    } else {
      entries.push({
        name: entry.name,
        path: fullPath,
        kind: 'directory',
        children: await readDirectoryStructure(entry, fullPath),
      })
    }
  }
  return entries
}
```

#### 2.2.2 Userscript 回退方案

由于 Userscript 运行在页面上下文中，`showDirectoryPicker()` 在 HTTPS 页面中通常可用：
- **Tampermonkey / Violentmonkey 环境**: 直接使用 `showDirectoryPicker()` 或 `<input webkitdirectory>` 回退
- **Chrome Extension 环境**: 可在 popup 或 offscreen document 中调用

#### 2.2.3 权限管理

- File System Access API 的权限是**暂时的**（关闭页面后失效）
- 需要实现 `requestPermission()` 在每次会话重新获取
- Chrome 122+ 支持持久权限（需要用户同意），详见 [Chrome Developers Blog](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)

---

### Phase 3: Agent 执行引擎

**预估工时：3-5 天**

#### 2.3.1 架构设计

参考 opencode 和 claude_code_src 的代码架构，Agent 引擎采用以下结构：

```
agent-runner/
├── types.ts              # Agent 相关类型定义
├── runner.ts             # 主执行引擎
├── tools/                # 工具函数
│   ├── fileOps.ts        # 文件读写
│   ├── search.ts         # 代码搜索
│   └── shell.ts          # 命令执行（可选）
└── context.ts            # 上下文管理
```

#### 2.3.2 Agent 执行流程

```
用户操作 → Content Script → 平台适配器 → 捕获对话 → 发送到 Agent 引擎
                                                      ↓
Agent 引擎 ←→ 文件系统 (读取项目文件)
    ↓
Agent 引擎 → AI 平台 → 获取响应
    ↓
Agent 引擎 → 文件系统 (写入修改后的文件)
    ↓
结果展示 → Content Script UI 更新
```

#### 2.3.3 核心消息协议

```typescript
// 消息类型
type AgentMessage = {
  type: 'EXECUTE_COMMAND' | 'READ_FILE' | 'WRITE_FILE' | 'LIST_FILES' | 'RUN_SHELL'
  payload: unknown
}

type AgentResponse = {
  success: boolean
  data?: unknown
  error?: string
}
```

---

### Phase 4: UI 组件与交互

**预估工时：2-3 天**

#### 2.4.1 项目选择器 UI

- 在 AI 网站页面上注入一个 "选择项目文件夹" 按钮
- 使用 Shadow DOM 渲染，样式完全隔离
- 显示当前选中的项目路径
- 显示项目文件树（可选折叠）

#### 2.4.2 Agent 控制面板

- 注入在聊天窗口附近的浮动面板
- 显示 Agent 执行状态（空闲/运行中/完成/错误）
- 显示文件操作日志
- 显示当前正在处理的文件

#### 2.4.3 弹窗 (Popup)

- 快速查看当前项目状态
- 切换项目文件夹
- 查看历史操作记录
- 设置页面（API key 等）

---

### Phase 5: 跨浏览器兼容与分发

**预估工时：2-3 天**

#### 2.5.1 分发渠道

| 渠道 | 方式 | 备注 |
|------|------|------|
| **Chrome Web Store** | 打包 `.zip` 上传 | 需要 Chrome 开发者账号（$5 注册费） |
| **Edge Add-ons** | 同上 | 免费，可用 Chrome 扩展直接导入 |
| **Greasy Fork** | 上传 `.user.js` | 全球最大 Userscript 仓库 |
| **GitHub Releases** | 发布 `.zip` + `.user.js` | 直接下载 |

#### 2.5.2 兼容性矩阵

| 浏览器 | Extension | Userscript | 备注 |
|--------|-----------|------------|------|
| Chrome | ✅ MV3 | ✅ Tampermonkey | 主力目标 |
| Edge | ✅ MV3 | ✅ Tampermonkey | Chrome 兼容 |
| Firefox | ✅ MV3 (实验) | ✅ Violentmonkey | `browser_specific_settings` |
| Safari | ❌ | ✅ Userscripts.app | 第三优先级 |
| Brave | ✅ MV3 | ✅ | Chrome 兼容 |

#### 2.5.3 Firefox 特别注意事项

- Firefox 不支持 `service_worker`，需要使用 `scripts` 字段
- `browser_specific_settings.gecko.id` 是必需的
- 使用 `webextension-polyfill` 抽象浏览器 API 差异

---

### Phase 6: 测试与发布

**预估工时：2-3 天**

#### 2.6.1 测试策略

- **单元测试**: Vitest 测试平台适配器、文件操作逻辑
- **手动测试**: 在各 AI 平台实际验证注入效果
- **回归测试**: 每次 AI 平台 UI 更新后检查选择器是否生效

#### 2.6.2 发布检查清单

- [ ] `npm run build` 通过，产出 `.user.js` 和 `dist/` 目录
- [ ] 在 Chrome 中加载 `dist/` 作为未打包扩展验证
- [ ] 在 Tampermonkey 中安装 `.user.js` 验证
- [ ] 所有目标 AI 网站均能正确注入
- [ ] 文件选择器正常工作
- [ ] `lsp_diagnostics` 无错误
- [ ] GitHub 仓库配置正确

---

## 3. 参考代码深度分析

### 3.1 claude_code_src (ponponon/claude_code_src) ✅ 已分析

**本质**: **Claude Code CLI** v2.1.88 的源代码（从 source map 恢复），约 70 万行 TypeScript。这是一个**终端 CLI 工具**，不是浏览器扩展。它与 opencode 类别相同——都是 terminal-based AI programming agent，但架构和设计模式对浏览器 Agent 引擎有重要参考价值。

#### 核心架构：Tool-Based Agent 模式

```
Tool (inputSchema, outputSchema, call, checkPermissions, ...)
  ├── FileReadTool     - 读文件（支持 offset/limit）
  ├── FileWriteTool    - 写文件（原子写入 + 陈旧性检测）
  ├── GlobTool         - 文件搜索（glob 模式）
  ├── GrepTool         - 内容搜索（正则）
  ├── BashTool         - 命令执行
  └── MCPTool          - 动态加载外部工具
```

**可借鉴的关键模式**:

| 模式 | 来源文件 | 描述 |
|------|---------|------|
| **Tool 生命周期** | `src/Tool.ts` | validateInput → checkPermissions → call → mapResult，每个阶段可拦截 |
| **Permission Context** | `src/types/permissions.js` | 三模式权限（default/bypass/auto）+ allow/deny 规则列表 |
| **文件状态追踪** | `src/utils/fileStateCache.js` | 记录 session 内读取过的文件及 mtime，写操作时检测并发修改 |
| **路径规范化** | `src/utils/path.js` | expandPath() 处理 ~、相对路径、空格 |
| **消息去重** | `src/bridge/bridgeMessaging.ts` | BoundedUUIDSet — 环状缓冲区 O(1) 去重 |
| **Session 管理** | `src/bridge/bridgeMain.ts` | 轮询 + 指数退避的会话管理（2s → 2min cap） |
| **MCP 集成** | `src/services/mcp/client.ts` | stdio/SSE/HTTP 传输层，动态工具注册 |
| **多 Provider** | `src/services/api/client.ts` | Bedrock/Foundry/Vertex/Direct API 切换 |

#### 可复用的 Tool 定义模式（翻译到浏览器扩展上下文）

```typescript
// claude_code_src 风格 → 浏览器扩展版
interface BrowserTool<Input, Output> {
  name: string
  schema: { input: ZodType<Input>, output: ZodType<Output> }
  execute(input: Input, ctx: ToolContext): Promise<Output>
  validate?(input: Input): ValidationResult
}

// 文件读取工具
const fileReadTool: BrowserTool<FileReadInput, FileReadOutput> = {
  name: 'read_file',
  schema: {
    input: z.object({
      file_path: z.string(),
      offset: z.number().optional(),
      limit: z.number().optional(),
    }),
    output: z.object({ content: z.string(), truncated: z.boolean() }),
  },
  async execute({ file_path, offset, limit }, { dirHandle }) {
    // 使用 File System Access API 读取
    const file = await getFileFromHandle(dirHandle, file_path)
    const text = await file.text()
    return {
      content: offset ? text.slice(offset, limit ? offset + limit : undefined) : text,
      truncated: !!(limit && text.length > offset + limit),
    }
  },
}
```

### 3.2 opencode (anomalyco/opencode) ✅ 已分析（通过 Web 文档）

**本质**: **终端 AI 编程 Agent**（CLI 工具），161k stars，TypeScript 实现。与 Claude Code 同类，但架构有独特之处。**注意：这是一个 CLI 工具，不是浏览器扩展。**

#### 核心架构：Package Monorepo + Client/Server

**项目结构**（基于 GitHub 目录分析）：

```
opencode/
├── packages/
│   ├── opencode/          # 核心 CLI 工具
│   │   ├── src/cli/       # CLI 命令入口
│   │   ├── src/server/    # Hono HTTP 服务器（端口 4096）
│   │   ├── src/session/   # 会话管理 + Agent 循环
│   │   ├── src/bus/       # 事件总线 (BusEvent)
│   │   ├── src/provider/  # AI 提供者适配（多 Provider）
│   │   └── src/tools/     # 工具定义
│   ├── console/           # TUI 终端界面
│   └── web/               # Web UI（桌面版）
├── sdks/vscode/            # VS Code 扩展 SDK
├── specs/                  # 协议规范
├── turbo.json              # Turborepo Monorepo 管理
├── bun.lock                # Bun 包管理器
└── flake.nix               # Nix 构建
```

#### 关键架构特点

| 特性 | 实现方式 | 可借鉴性 |
|------|---------|---------|
| **Agent 双模式** | `build`（全权限）+ `plan`（只读）双 Agent，Tab 键切换 | ⭐⭐⭐ 高 - 浏览器扩展可区分"读/写"模式 |
| **Provider 无关** | 支持 Claude/OpenAI/Google/本地模型，统一接口切换 | ⭐⭐⭐⭐ 高 - 浏览器扩展让用户自选 API |
| **事件总线 BusEvent** | 集中式事件总线，Zod schema 强类型事件定义 | ⭐⭐⭐⭐ 高 - 简化 content ↔ background 通信 |
| **SSE 流式** | Server-Sent Events 推送工具执行结果和消息增量 | ⭐⭐ 中 - 浏览器扩展可用 `ReadableStream` |
| **权限系统** | 工具级权限检查（ask/auto/deny 三模式） | ⭐⭐⭐⭐ 高 - 文件操作需要用户确认 |
| **Client/Server** | 本地 Hono 服务器（端口 4096）+ 远程 UI 代理 | ⭐⭐ 中 - 浏览器扩展用 Service Worker 替代 |
| **会话管理** | Session Handle + 心跳保活 + 指数退避轮询 | ⭐ 低 - 浏览器扩展生命周期更简单 |
| **消息增量流式** | `message.part.updated` 事件带 `delta` 字段 | ⭐⭐⭐ 中 - 可用于流式显示工具执行结果 |

#### 从 opencode 可复用的关键模式

```typescript
// 1. 双 Agent 模式 → 浏览器扩展中的"读写模式"
interface AgentMode {
  name: 'build' | 'plan'
  permissions: {
    readFile: boolean
    writeFile: boolean
    execCommand: 'ask' | 'auto' | 'deny'
  }
}

// 2. 事件总线模式 → 简化 content ↔ background 通信
// 所有事件通过 Zod schema 定义，类型安全
const BusEvents = {
  'file.read': z.object({ path: z.string(), content: z.string() }),
  'file.written': z.object({ path: z.string(), success: z.boolean() }),
  'agent.status': z.object({ status: z.enum(['idle','running','error']) }),
  'permission.requested': z.object({ tool: z.string(), path: z.string().optional() }),
  'permission.granted': z.object({ tool: z.string(), approved: z.boolean() }),
} as const

// 3. Provider 无关设计 → 用户可配置
interface AIProviderConfig {
  type: 'openai' | 'anthropic' | 'google' | 'custom'
  apiKey?: string
  baseUrl?: string
  model: string
}

// 4. 工具权限系统 → 文件操作安全
interface ToolPermissions {
  mode: 'auto' | 'ask' | 'deny'  // 默认行为
  allowPaths: string[]             // 允许的路径前缀
  denyPaths: string[]              // 拒绝的路径（如 .env, node_modules）
}

// 5. 流式增量事件 → 实时展示工具执行进度
type BusEvent =
  | { type: 'message.part.updated'; delta: string }
  | { type: 'permission.asked'; tool: string; args: unknown }
  | { type: 'server.connected'; heartbeat: number }
  | { type: 'question.asked'; question: string }
```

### 3.3 其他有价值的参考
- **Glassbox** (owenkleinmaier/glassbox): DOM 选择器策略（多级回退、按平台维护），SELECTORS.md 文档详细记录了 chatgpt/claude/gemini 的各选器
- **chat-archive** (fxops-ai/chat-archive): 各平台 DOM 结构的逆向工程文档（含 Gemini 的"点击编辑按钮提取内容"的 hack 技巧）
- **universal-prompt-library**: 跨平台注入引擎、文件夹组织 UI、拖拽排序
- **vite-plugin-monkey**: 双输出构建（Userscript + Extension），`GM_*` API 兼容
- **vite-plugin-web-extension** (samrum): WebExtension 的 Vite 构建替代方案
- **vite-userscript-plugin**: 专注于 Tampermonkey Userscript 的 Vite 插件
- **vite-vue3-browser-extension-v3** (mubaidr): Vite + Vue3 浏览器扩展脚手架模板
- **mem0-chrome-extension** (mem0ai): 多 AI 平台注入的参考实现（含 DeepSeek 选择器）

---

## 4. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| AI 平台 UI 变更导致选择器失效 | 高 | 中 | 多级选择器回退 + 定期验证 + 快速修复机制 |
| File System Access API 兼容性 | 中 | 高 | 提供 `<input webkitdirectory>` 回退方案 |
| 浏览器 CSP 限制脚本注入 | 中 | 中 | 使用 `GM_addElement` (Userscript) 或 `web_accessible_resources` (Extension) |
| Userscript 和 Extension API 差异 | 高 | 中 | 抽象层 + vite-plugin-monkey 的条件编译 |
| 项目规模超出预期 | 中 | 低 | 分阶段开发，Phase 1-2 先出 MVP |

---

## 5. 第一阶段 MVP 范围

**最简可用产品**: 只做核心链路

1. ✅ 在 ChatGPT 和 Claude 两个平台注入
2. ✅ 用户选择项目文件夹
3. ✅ 读取项目文件结构
4. ✅ 在聊天中引用项目文件
5. ✅ 写入文件修改

**不做**:
- ❌ 复杂 UI（仅用最简单的注入按钮）
- ❌ Agent 自动执行（仅手动触发）
- ❌ Firefox / Safari 兼容（先聚焦 Chrome）
- ❌ 完整的设置页面

---

*计划版本: v0.1.0*
*最后更新: 2026-05-15*

---

## 附录A: 参考代码完整分析

### A.1 claude_code_src 深度分析

| 维度 | 细节 |
|------|------|
| **仓库** | ponponon/claude_code_src |
| **本质** | Claude Code CLI v2.1.88 源码（从 source map 恢复） |
| **规模** | ~70 万行 TypeScript |
| **类型** | Node.js CLI 工具（非浏览器扩展） |

**核心文件架构**:
| 文件 | 功能 | 行数 |
|------|------|------|
| `src/query.ts` | 主 Agent 循环 | 1729 |
| `src/Tool.ts` | Tool 定义框架（生命周期钩子） | 792 |
| `src/tools.ts` | 工具注册管理 | - |
| `src/tools/FileReadTool/FileReadTool.ts` | 文件读取 | 1183 |
| `src/tools/FileWriteTool/FileWriteTool.ts` | 文件写入 | 434 |
| `src/tools/GlobTool/GlobTool.ts` | 文件搜索 | 198 |
| `src/tools/GrepTool/GrepTool.ts` | 内容搜索 | 577 |
| `src/services/api/client.ts` | AI Provider 适配 | 389 |
| `src/bridge/bridgeMain.ts` | Bridge 主循环（会话管理） | 2999 |
| `src/bridge/bridgeMessaging.ts` | 消息处理 & UUID 去重 | 461 |
| `src/services/mcp/client.ts` | MCP 客户端（动态工具加载） | 3348 |

**Tool 定义模式**:
```typescript
export type ToolDef<InputSchema, OutputSchema> = {
  name: string
  inputSchema: InputSchema       // Zod schema
  outputSchema: OutputSchema     // Zod schema
  async validateInput(input, ctx): ValidationResult
  async checkPermissions(input, ctx): PermissionDecision
  async call(input, ctx): Output
  async mapResult(output, ctx): FormattedOutput
}
```

### A.2 opencode 深度分析

| 维度 | 细节 |
|------|------|
| **仓库** | anomalyco/opencode |
| **本质** | 开源 AI 编程 Agent（CLI 工具） |
| **规模** | ~161k stars, TypeScript 60% + MDX 29% |
| **类型** | CLI + Monorepo（非浏览器扩展） |

**关键架构组件**:
| 组件 | 文件路径（推测） | 功能 |
|------|----------------|------|
| CLI 入口 | `packages/opencode/src/cli/cmd/web.ts` | `opencode web` 命令 |
| HTTP 服务器 | `packages/opencode/src/server/server.ts` | Hono 服务器（端口 4096） |
| 会话路由 | `packages/opencode/src/server/routes/session.ts` | 会话和消息处理 |
| 事件总线 | `packages/opencode/src/bus/bus-event.ts` | 集中式事件广播 |
| SSE | `packages/opencode/src/server/routes/session.ts` | Server-Sent Events 流式推送 |
| 权限路由 | `packages/opencode/src/server/routes/permission.ts` | 权限请求/审批 |

**Agent 模式**:
- **build**: 默认模式，全权限（文件读写 + 命令执行）
- **plan**: 只读模式，拒绝文件编辑，执行命令需确认
- **@general**: 通用子 Agent，用于复杂搜索和多步骤任务

**事件流**（SSE）:
```
server.connected       → 客户端连接成功
message.part.updated   → 消息内容增量更新（delta 字段）
question.asked         → 向用户提问
permission.asked       → 请求操作权限
permission.replied     → 用户回复权限请求
heartbeat              → 30 秒心跳保活
```

### A.3 DOM 选择器完整汇总

| 平台 | 输入框选择器（优先级排序） | 消息容器 | AI 响应内容 | 发送按钮 | 稳定性评级 |
|------|--------------------------|---------|-------------|---------|-----------|
| **ChatGPT** | `#prompt-textarea` → `div.ProseMirror` → `div[contenteditable="true"][data-id]` | `main[role="main"]` | `[data-message-author-role="assistant"]` | `button[data-testid="send-button"]` | ⭐⭐⭐⭐ |
| **Claude** | `div[contenteditable="true"]` | `div.font-claude-message` | `.font-claude-response` → `[data-testid="ai-message"]` | 最近提交按钮 | ⭐⭐⭐⭐ |
| **Gemini** | `div[contenteditable="true"]` → `ms-autosize-textarea` | `ms-chat-turn` | `.model-response` → `[data-test-id="model-response"]` | 发送图标按钮 | ⭐⭐⭐ |
| **DeepSeek** | `.textarea__textarea`（自定义组件） | `.ds-message` | `.ds-assistant-message-main-content` | `.ds-basic-button--primary` | ⭐⭐⭐⭐ |
| **Kimi** | `.chat-input-editor`（contenteditable div） | `.message-list-container` / `.message-list` | `.message-content` / `.kimi-animated-list` | `.send-icon` / `.send-button-container` | ⭐⭐⭐⭐⭐ |
| **豆包** | `[class*="input-content-container"]` | CSS Module 动态类 | CSS Module 动态类 | `[class*="send-btn-wrapper"]` | ⭐⭐ |
| **元宝** | `.chat-input-editor` / `.ql-container` / `.yb-input-box-textarea` | `.agent-dialogue__content--common__content` | `.agent-dialogue__content-split-pane` | `.icon-send` / `[class*="send-btn"]` | ⭐⭐⭐⭐ |

### A.4 DeepSeek (chat.deepseek.com) 逆向分析报告

**分析方法**: Chrome headless 获取初始 HTML + CSS bundle 解析 + JS main bundle 字符串提取
**认证状态**: 未登录（页面停留在登录界面），但通过 JS bundle 提取了完整的选择器信息

#### 架构概览

| 维度 | 细节 |
|------|------|
| **框架** | React + Webpack (data-webpack="@deepseek/chat") |
| **样式方案** | CSS Modules（布局组件）+ DS Design System（基础组件） |
| **CDN** | `fe-static.deepseek.com/chat/static/` |
| **核心 JS** | `main.190cf1db56.js`（约 2MB+） |
| **CSS** | `main.6dfc92c170.css` |
| **构建 ID** | `59344f68` |
| **SSR** | 否，纯 SPA |
| **Auth** | 手机号 + 验证码 / 微信扫码 / Apple ID |
| **设计系统** | 自定义 DS 系统（`ds-*` 类名前缀） |

#### 登录页面 DOM 结构

```
#root
  .ds-theme
    .c994dda2                             ← 主容器
      ._47c279e                           ← 顶部分隔
      ._99ad066                           ← 登录区域居中容器
        .ds-auth-form-wrapper
          .ds-sign-in-form-wrapper
            .ds-sign-in-form__icon        ← DeepSeek logo
            .ds-sign-in-form__main         ← 登录表单主体
              .ds-form-item               ← 手机号输入
                .ds-input.ds-input--bordered.ds-input--l
                  .ds-input__prefix        ← "+86"
                  input.ds-input__input    ← 手机号输入框 (type="tel")
              .ds-verify-code-input-form-item
                .ds-input
                  input.ds-input__input    ← 验证码输入 (maxlength=6)
                  .ds-input__suffix
                    .ds-verify-code-input-divider
                    button.ds-link-button  ← "发送验证码"
              .ds-basic-button--primary    ← "登录"按钮
      ._5178cc4                           ← 底部 footer
        .ds-auth-footer                    ← 备案号/联系我们

      微信扫码:
        .ds-sign-in-with-wechat-block
          iframe ← https://open.weixin.qq.com/connect/qrconnect...
```

#### 聊天界面 DOM 结构（根据 JS bundle 推断）

```
#root
  .ds-theme
    [CSS Module Layout Container]
      [Sidebar / Conversation List]
        ├── .searchbox                    ← 搜索框
        ├── button (newChat)              ← 新建对话
        ├── session-history-timeline      ← 对话历史时间线
        │   ├── sessionHistoryTimelineLabelToday
        │   ├── sessionHistoryTimelineLabelYesterday
        │   ├── sessionHistoryTimelineLabel7days
        │   └── sessionHistoryTimelineLabel30days
        └── .conversation-search-results  ← 搜索结果面板
            └── .search-view-card__title
            └── .search-view-card__snippet

      [Main Chat Area]
        ├── .ds-scroll-area               ← 对话滚动区域
        │   ├── .ds-message               ← 每条消息
        │   │   ├── (user message)
        │   │   │   ├── copyUserMessage
        │   │   │   └── editMessage
        │   │   └── (assistant message)
        │   │       ├── .ds-assistant-message-main-content  ← AI 响应内容
        │   │       │   └── .ds-markdown                    ← Markdown 渲染
        │   │       │       ├── .ds-markdown-paragraph
        │   │       │       ├── .ds-markdown-cite
        │   │       │       ├── .ds-markdown-html
        │   │       │       ├── .ds-markdown-math
        │   │       │       └── .ds-markdown-code-copy-button
        │   │       ├── .ds-fancy-box    ← 图片/文件附件查看器
        │   │       │   ├── .ds-fancy-box__slide
        │   │       │   ├── .ds-fancy-box__thumbnails
        │   │       │   ├── .ds-fancy-box__side-toolbar
        │   │       │   └── .ds-fancy-box__top-toolbar
        │   │       ├── regenerateMessage
        │   │       └── thinking          ← 深度思考内容
        │   └── ... (more messages)
        │
        └── [Input Area]
            ├── .textarea                 ← Chat input 组件（自定义）
            │   ├── .textarea__textarea   ← 实际输入框
            │   ├── .textarea--auto-height ← 自动高度
            │   ├── .textarea--focused    ← 焦点状态
            │   └── .textarea__mirror     ← 高度计算镜像元素
            ├── modelSwitchExpose         ← 模型切换
            ├── thinkingSwitch            ← 深度思考开关
            ├── searchEnabledToggle       ← 联网搜索开关
            ├── file_picker               ← 文件上传按钮
            └── .ds-basic-button--primary  ← 发送按钮
```

#### 关键选择器总结

| 目标 | 选择器策略 | 稳定性 |
|------|-----------|--------|
| **侧边栏搜索** | `.searchbox` 或 `[class*="searchbox"]` | ⚠️ CSS Module hash |
| **聊天输入框** | `.textarea__textarea` 或 `div[class*="textarea__textarea"]` | ✅ 类名稳定 |
| **AI 消息内容** | `.ds-assistant-message-main-content` | ✅ DS 系统类 |
| **Markdown 渲染** | `.ds-markdown` | ✅ DS 系统类 |
| **消息容器** | `.ds-message` | ✅ DS 系统类 |
| **发送按钮** | `.ds-basic-button.ds-basic-button--primary` | ✅ DS 系统类 |
| **模型切换** | `[class*="modelSwitch"]` | ⚠️ 可能 minify |
| **文件上传** | `[class*="file_picker"]` | ⚠️ 可能 minify |

#### 关键发现

1. **DeepSeek 不使用 data-testid 属性**（和 ChatGPT/Claude 不同），测试属性在 Chrome headless dump-dom 和 JS bundle 中均未发现
2. **CSS Modules 哈希** `_XXXXXXX` 用于布局组件，每次构建会变化；但 DS 设计系统类名（`ds-*`）保持稳定
3. **聊天输入框**是自定义组件（非原生 textarea），类名 `textarea__textarea` 相对稳定
4. **文件系统**非常完善：有 `file_picker`、`file_upload`、`file_parse_track`、`file_parse_result`、文件大小限制验证
5. **历史记录使用 IndexedDB**：通过 `historyIdbPromise` 变量名推断
6. **SPA 路由模式**：`https://chat.deepseek.com/a/chat/s/{sessionId}`（基于 session ID 的路径结构）
7. **网页搜索**、**深度思考**为独立开关，可通过 JavaScript 触发
8. **UI 注入推荐位置**：侧边栏底部、输入框上方或消息流中的注入点

---

### A.5 豆包 (www.doubao.com) 逆向分析报告

**分析方法**: Chrome headless 获取初始 HTML（登录后 SPA 页面） + JS chat bundle 字符串提取
**架构**: React SPA，CDN: `lf-flow-web-cdn.doubao.com`，Webpack 分块加载

#### 架构概览

| 维度 | 细节 |
|------|------|
| **框架** | React + Webpack |
| **CDN** | `lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/chat/` |
| **主 JS** | `chat.5f9b0da2.js` |
| **样式方案** | CSS Modules（`*-XXXXXX` hash 类名）+ Tailwind（`items-center`, `text-14` 等） |
| **登录状态** | 访问 `/chat/` 可进入未登录状态下的首页（含侧边栏和部分内容） |

#### DOM 结构

```
body
  #root
    [header]                          ← 顶部导航 h-[var(--header-height)]
    .main-with-nav-qPJ0z0             ← 主布局容器
      .left-side-U7A0kz               ← 左侧侧边栏
        .left-side__expand-OIQFEm     ← 展开的侧边栏
        .left-side-sm-fixed-XHrOd1    ← 固定模式
        .nav-link-IkIer0              ← 导航链接
        .group/sidebar_nav_item       ← 侧边栏导航项（Tailwind group）
        [sidebar content]...
      [main-content]                  ← 主内容区域
        .max-w-(--content-max-width)   ← 内容宽度限制
        .input-content-container-bMefgL  ← 输入框容器
          [chat input engine]
            send-btn-wrapper           ← 发送按钮
```

#### 关键选择器

| 目标 | 选择器策略 | 稳定性 |
|------|-----------|--------|
| **侧边栏** | `.left-side-U7A0kz` / `[class*="left-side-"]` | ⚠️ CSS Module hash |
| **导航链接** | `.nav-link-IkIer0` | ⚠️ CSS Module hash |
| **输入框容器** | `.input-content-container-bMefgL` / `[class*="input-content-container"]` | ⚠️ CSS Module hash |
| **发送按钮** | `[class*="send-btn-wrapper"]` / `.send-btn-wrapper` | ⚠️ CSS Module hash |
| **对话列表** | `[class*="sidebar"]` 通配 | ⚠️ 通配匹配 |

#### 关键发现

1. **Tailwind 大量使用** — 很多类名是 Tailwind 原子类（`items-center`, `text-14`, `flex` 等）
2. **CSS Module hash** — 核心组件使用 CSS Modules，类名模式：`<name>-<hash>`
3. **无统一设计系统类名** — 不像 DeepSeek 有 `ds-*` 体系，更难找到稳定选择器
4. **自定义输入引擎** — `input-engine`、`input-guidance` 等组件名称表明输入框使用自定义引擎
5. **发送按钮**在未登录状态下不可见，只能通过 bundle 推断
6. **注入策略**：侧边栏底部（`.left-side-*` 区域内）、输入框上方（`.input-content-container-*` 上方）、或通过 MutationObserver 监听 DOM 变化后注入

### A.6 元宝 (yuanbao.tencent.com) 逆向分析报告

**分析方法**: Chrome headless 获取 Next.js SSR HTML + 分析 JS chunk 结构
**架构**: Next.js 应用，TDesign UI 组件库，腾讯内部生态

#### 架构概览

| 维度 | 细节 |
|------|------|
| **框架** | **Next.js** + React |
| **CDN** | `static.yuanbao.tencent.com/modern/_next/static/chunks/` |
| **UI 库** | **TDesign**（腾讯设计系统，`t-*` 类名）+ 自定义样式 |
| **主 JS** | `yb_v2_main.*.js` |
| **聊天专用** | `yb_v2_yb-chat.*.js` — 聊天功能独立分包 |
| **构建** | Next.js 标准分块（polyfills / runtime / vendor / main / pages） |

#### DOM 结构

```
body
  #__next                              ← Next.js 根节点
    [header]                            ← `.yb-common-nav__*`
      .yb-common-nav__ft_wrap
      .yb-common-nav__tool
      .yb-common-nav__trigger
    .agent-dialogue                    ← 对话主容器
      .agent-dialogue__content
        .agent-dialogue__content--common
          .agent-dialogue__content--common__header    ← 对话头部
          .agent-dialogue__content--common__content   ← 对话内容区
            .agent-dialogue__content-split-pane        ← AI 响应的分栏内容
            .message_revoke                            ← 消息撤回
          .agent-dialogue__content--common__input      ← 输入区域
            .agent-dialogue__content--common__input-box
            .agent-dialogue__content--common__input__content
              [Input area]
                .agent-input-text-area                  ← 输入框区域
                  .style__text-area___JRVgQ             ← 文本域样式模块
                  .style__text-area--pc___H5tSZ         ← PC 模式
                    .ql-container                       ← Quill.js 富文本编辑器
                    .style__text-area__wrapper___v8PgB
                      .InputTextArea_hightLightTextAreaNew__aKxTD
                      .style__text-area__edit___BKkcb
                        .chat-input-editor              ← 聊天输入编辑器
                .style__text-area__start___B3hfY        ← 输入框起始区域
                .style__text-area__start--placeholder___TuTF8 ← 占位符
                .style__text-area__end___ow95N          ← 输入框结束区域
                .style__text-area__actions___S50n4      ← 操作栏
                .style__text-area__toolbar___yAF6v      ← 工具栏
                  .style__text-area__attachment___Ek2Kp  ← 附件按钮
                  .style__send-btn___RwTm5               ← 发送按钮
                    .icon-send                           ← 发送图标
      .agent-dialogue__content--common__homepage  ← 首页
      .agent-dialogue__content--common__line      ← 分隔线
      .agent-dialogue__content-copyright           ← 版权信息
```

#### 关键选择器

| 目标 | 选择器策略 | 稳定性 |
|------|-----------|--------|
| **对话容器** | `.agent-dialogue` | ✅ 语义化类名，稳定 |
| **对话内容区** | `.agent-dialogue__content--common__content` | ✅ 语义化 BEM 风格，稳定 |
| **AI 响应** | `.agent-dialogue__content-split-pane` | ✅ BEM 风格 |
| **输入框 (富文本)** | `.chat-input-editor` 或 `.ql-container` | ✅ 语义化（Quill.js + 自定义）|
| **输入框 (纯文本)** | `.yb-input-box-textarea` | ✅ 稳定 |
| **发送按钮** | `.style__send-btn___RwTm5` 或 `.icon-send` | ⚠️ CSS Module hash |
| **附件按钮** | `[class*="attachment"]` | ⚠️ 通配 |
| **导航栏** | `.yb-common-nav__*` | ✅ BEM 风格，稳定 |

#### 关键发现

1. **Next.js 架构** — SSR 支持，页面在未登录状态下也能渲染部分内容
2. **TDesign UI 库** — 使用腾讯 TDesign 组件（`t-button__text`, `t-skeleton` 等）
3. **Quill.js 富文本编辑器** — 输入框使用 Quill.js（`.ql-container`），说明消息输入支持富文本格式
4. **BEM 类名** — `agent-dialogue__*` 系列使用 BEM 命名规范，**稳定性高**
5. **CSS Module 混合** — 部分组件使用 CSS Modules（`style__text-area___XXX`），部分使用语义化类名
6. **注入策略**：对话内容区（`.agent-dialogue__content--common__content`）前后、工具栏区域、侧边栏区域

### A.7 Kimi (kimi.moonshot.cn) 逆向分析报告

**分析方法**: Chrome headless 获取初始 HTML + JS main bundle 字符串提取
**架构**: Vite 构建的 React SPA

#### 架构概览

| 维度 | 细节 |
|------|------|
| **框架** | React + Vite |
| **CDN** | `statics.moonshot.cn/kimi-web-seo/assets/` |
| **主 JS** | `index-BOi0_z_1.js` |
| **Vendor** | `vendor-BDu1S-hQ.js` |
| **CSS** | `vendor-DCkjUWbE.css` + `index-Bi1tSNDv.css` |

#### DOM 结构

```
body
  #root
    .layout-container                    ← 根布局
      .layout-header                     ← 顶部导航
        .header-left / .header-center / .header-right
        .nav-icon / .nav-icon--default / .nav-icon--arrow
        .user-nav-icon
      .layout-content                    ← 主内容区
        .has-sidebar
          .sidebar                       ← 左侧边栏
            .sidebar-header              ← 侧边栏头部
              .new-chat-btn               ← 新建对话按钮
              .sidebar-new-chat
            .sidebar-nav                 ← 侧边栏导航
              .nav-item
                .menu-item
                  .claw-item             ← Claw 对话项
                  .claw-item-title
                  .claw-unread-badge
                  .kfc-item              ← KFC 功能项
            .sidebar-footer              ← 侧边栏底部
              .sidebar-footer-content
                .download-app-btn
                .expand-btn
          .layout-content-main          ← 聊天主区域
            .chat-box                    ← 对话主容器
              .message-list-container    ← 消息列表容器
                .message-list            ← 消息列表
                  .message-container     ← 消息容器
                    .message-content     ← 消息内容
                  .kimi-animated-list    ← 动画消息列表
                  .kfc-item
              .chat-editor               ← 聊天编辑器区域
                .chat-input              ← 输入框容器
                  .chat-input-editor-container
                    .chat-input-editor   ← 输入编辑器（contenteditable）
                    .chat-input-placeholder ← 占位符
                  .chat-input-prepend    ← 输入前置区域
                  .chat-editor-action    ← 编辑器操作
                .send-button-container    ← 发送按钮容器
                  .send-icon              ← 发送图标
```

#### 关键选择器

| 目标 | 选择器策略 | 稳定性 |
|------|-----------|--------|
| **侧边栏** | `.sidebar` | ✅ 语义化类名，稳定 |
| **新建对话** | `.new-chat-btn` / `.sidebar-new-chat` | ✅ 稳定 |
| **对话项** | `.claw-item` / `.claw-item-title` | ✅ 语义化，"Claw" 品牌名 |
| **消息列表** | `.message-list-container` / `.message-list` | ✅ 语义化，稳定 |
| **消息内容** | `.message-content` / `.message-container` | ✅ 语义化，稳定 |
| **输入框** | `.chat-input-editor`（contenteditable div） | ✅ 语义化，稳定 |
| **发送按钮** | `.send-icon` / `.send-button-container` | ✅ 语义化，稳定 |
| **KFC 功能** | `.kfc-item` | ✅ 语义化 |
| **动画列表** | `.kimi-animated-list` | ✅ 品牌前缀 |

#### 关键发现

1. **Vite 构建** — 现代化构建工具，文件名带 hash
2. **语义化类名** — 大部分类名有意义（`.sidebar`, `.message-content`, `.chat-input-editor`），**稳定性极高**
3. **Kimi 品牌命名** — `kimi-*` 前缀、`claw-*`（Claw 对话系统）、`kfc-*`（KFC 功能模块）
4. **动画系统** — `kimi-animated-list` 表明支持流式输出的动画效果
5. **UI 注入推荐位置**：侧边栏底部（`.sidebar-footer`）、输入框上方（`.chat-editor` 上方）、消息列表底部
6. **contenteditable 输入框** — 类似 ChatGPT 的实现，支持富文本输入

---

### A.8 ChatGPT (chatgpt.com) 逆向分析报告

**分析方法**: 基于现有开源项目的 DOM 选择器研究成果（Glassbox、chat-archive、DeepSeek Chat Advanced 等项目）+ 已知的 API 和框架信息
**访问限制**: 网站完全阻止 curl/headless 直接访问（返回空响应），需要登录后 SPA 渲染

#### 架构概览

| 维度 | 细节 |
|------|------|
| **框架** | React + Next.js（推测基于页面结构和路由模式） |
| **构建** | webpack（生产环境高度混淆） |
| **数据属性** | `data-message-author-role`, `data-testid`, `data-message-id` |
| **输入方式** | contenteditable div（ProseMirror 富文本编辑器） |
| **消息渲染** | Markdown + 类名 `.markdown` / `.prose` |

#### DOM 结构（基于已有研究成果）

```
body
  #__next                                  ← Next.js 根节点
    [Layout Container]
      nav/navbar                           ← 顶部导航
      main[role="main"]                     ← 主聊天区域
        [Conversation Container]
          [data-testid^="conversation-turn-"] ← 每个对话轮次
            [data-message-author-role="user"]
              .whitespace-pre-wrap           ← 用户消息文本
            [data-message-author-role="assistant"]
              .markdown / .prose             ← AI 响应的 Markdown 渲染
                pre / code                   ← 代码块
                p                           ← 段落
              [data-testid="copy-button"]   ← 复制按钮
        [Input Area]
          form                              ← 输入表单
            #prompt-textarea                ← 主输入框（contenteditable div）
              p                             ← 输入文本段落
            button[data-testid="send-button"] ← 发送按钮
```

#### 关键选择器

| 目标 | 选择器 | 来源 | 稳定性 |
|------|--------|------|--------|
| **输入框** | `#prompt-textarea` | Glassbox / 直接观察 | ⭐⭐⭐⭐⭐ ID 选择器 |
| **输入框后备** | `div.ProseMirror[contenteditable="true"]` | bchewy/chatgpt-sender | ⭐⭐⭐ ProseMirror 类名 |
| **输入框后备2** | `div[contenteditable="true"][data-id]` | semantest/nodejs.server | ⭐⭐⭐⭐ |
| **输入框后备3** | `div[contenteditable="true"][role="textbox"]` | 通用 | ⭐⭐⭐ |
| **AI 响应** | `[data-message-author-role="assistant"]` | Glassbox/chat-archive | ⭐⭐⭐⭐ data 属性 |
| **用户消息** | `[data-message-author-role="user"]` | Glassbox | ⭐⭐⭐⭐ |
| **对话轮次** | `[data-testid^="conversation-turn-"]` | chat-archive | ⭐⭐⭐⭐ |
| **发送按钮** | `button[data-testid="send-button"]` | bchewy/chatgpt-sender | ⭐⭐⭐⭐ |
| **发送按钮后备** | `form button[type="submit"]` | semantest | ⭐⭐⭐ |
| **消息内容** | `.markdown` / `.whitespace-pre-wrap` | chat-archive | ⭐⭐⭐ 类名 |
| **主容器** | `main[role="main"]` | 通用 | ⭐⭐⭐⭐⭐ |

#### 注入策略

- **输入框下方/右侧**: `#prompt-textarea` 附近，作为输入扩展
- **侧边栏**: OpenAI 的侧边栏有自定义内容区域
- **注入时机**: SPA 页面加载后 + MutationObserver 监听 DOM 变化
- **输入方式**: 通过 `execCommand('insertText')` 或 `textContent` + dispatchEvent('input')

#### 关键发现

1. **ProseMirror 编辑器** — ChatGPT 使用 ProseMirror 富文本框架，文本注入需使用 `execCommand` 或直接操作 DOM + 触发 input 事件
2. **data-testid 是最稳定选择器** — OpenAI 内部测试 ID，虽非公开 API 但变化频率低
3. **`data-message-author-role` 属性** — 区分 user/assistant 消息的可靠方式
4. **注入推荐位置**: 输入框上方/右侧、侧边栏底部

### A.9 Claude (claude.ai) 逆向分析报告

**分析方法**: 基于已有开源项目研究成果（Glassbox、chat-archive）+ 已知架构信息
**访问限制**: 区域限制访问（显示 "App unavailable in region"），可通过 VPN 或登录访问

#### 架构概览

| 维度 | 细节 |
|------|------|
| **框架** | React（推测） |
| **构建** | 自定义构建（非标准 Next.js） |
| **数据属性** | `data-testid`（大量使用） |
| **输入方式** | contenteditable div |
| **消息渲染** | Markdown（`.standard-markdown` / `.progressive-markdown`） |
| **CSS 命名** | 类名 + `font-claude-*` 字体相关的 class |

#### DOM 结构（基于已有研究成果）

```
body
  #root                                    ← React 根节点
    [Claude Layout]
      [Sidebar]
        nav                                ← 对话历史导航
      [Main Content]
        [Conversation Container]
          [data-testid="human-message"]     ← 用户消息
            .font-user-message
          [data-testid="ai-message"]        ← AI 消息（旧版）
            .font-claude-response            ← AI 消息（当前版，2026.3）
              .standard-markdown             ← Markdown 内容
              .progressive-markdown          ← 流式输出 Markdown
              button[data-testid="action-bar-copy"] ← 复制按钮
          [data-is-streaming]               ← 流式输出中标记
          [data-test-render-count]           ← 渲染计数
          .artifact-block-cell               ← Artifact 代码块
        [Composer / Input Area]
          div[contenteditable="true"]        ← 输入编辑器
          [Send Button]                     ← 发送按钮
```

#### 关键选择器

| 目标 | 选择器 | 来源 | 稳定性 |
|------|--------|------|--------|
| **输入框** | `div[contenteditable="true"]` | Glassbox/通用 | ⭐⭐⭐ 通用选择器 |
| **AI 响应** | `.font-claude-response` | Glassbox (2026.3) | ⭐⭐⭐⭐ 当前版 |
| **AI 响应后备** | `[data-testid="ai-message"]` | chat-archive | ⭐⭐⭐⭐ |
| **用户消息** | `[data-testid="human-message"]` | chat-archive | ⭐⭐⭐⭐ |
| **消息内容** | `.standard-markdown` | Glassbox (2026.3) | ⭐⭐⭐ 当前版 |
| **消息内容后备** | `.font-claude-message` | chat-archive | ⭐⭐⭐ |
| **复制按钮** | `button[data-testid="action-bar-copy"]` | chat-archive | ⭐⭐⭐⭐ |
| **Artifact** | `.artifact-block-cell` | chat-archive | ⭐⭐⭐ |
| **流式标记** | `[data-is-streaming]` | chat-archive | ⭐⭐⭐ |
| **渲染计数** | `[data-test-render-count]` | chat-archive | ⭐⭐ 内部属性 |

#### 注入策略

- **输入框上方**: contenteditable div 附近
- **侧边栏底部**: Claude 的侧边栏可扩展
- **注入时机**: SPA 加载后 + MutationObserver 监听
- **输入方式**: 通过 contenteditable div 的 `execCommand` / `innerText` 注入

#### 关键发现

1. **`.font-claude-response` 是当前最稳定的 AI 消息选择器**（2026 年 3 月验证）
2. **大量使用 `data-testid`** — Anthropic 内部测试 ID，类似 OpenAI 的做法
3. **Claude 有复制按钮 hack** — chat-archive 项目通过点击复制按钮(`action-bar-copy`)提取内容
4. **Artifact 系统** — `.artifact-block-cell` 用于代码块/文档展示
5. **流式输出支持** — `[data-is-streaming]` 属性标记正在生成的响应
6. **注入推荐位置**: 输入框区域、侧边栏底部

### A.10 Gemini (gemini.google.com) 逆向分析报告

**分析方法**: 基于已有开源项目研究成果（Glassbox、chat-archive）
**访问限制**: Google 登录墙，headless 无法访问 SPA 内容

#### 架构概览

| 维度 | 细节 |
|------|------|
| **框架** | Google Web 组件（`ms-*` 自定义元素）+ Material Design |
| **构建** | Google 内部构建系统 |
| **关键元素** | `ms-chat-turn`, `ms-thought-chunk`, `ms-autosize-textarea` |
| **数据属性** | `data-test-id`（Google 风格） |
| **输入方式** | contenteditable div + `ms-autosize-textarea` |

#### DOM 结构（基于已有研究成果）

```
body
  [Gemini App Container]
    [Sidebar / History]
      nav                               ← 对话历史
    [Chat Container]
      ms-chat-turn                      ← 每个对话轮次（自定义 web component）
        .chat-turn-container            ← 轮次容器
          [User Message]
            .user-query                 ← 用户查询
            [data-test-id="user-query"]
          [Assistant Response]
            .model-response             ← 模型响应
            [data-test-id="model-response"]
            ms-thought-chunk            ← 思考过程内容（自定义组件）
              [Edit Mode]
                ms-autosize-textarea[data-value] ← 编辑时显示
                button[aria-label="Edit"]        ← 编辑按钮
      [Composer Area]
        div[contenteditable="true"]      ← 主要输入框
        ms-autosize-textarea             ← 备选输入
        [Send Button]                    ← 发送图标按钮
```

#### 关键选择器

| 目标 | 选择器 | 来源 | 稳定性 |
|------|--------|------|--------|
| **输入框** | `div[contenteditable="true"]` | Glassbox/通用 | ⭐⭐⭐ |
| **输入框后备** | `ms-autosize-textarea` | chat-archive | ⭐⭐⭐⭐ 自定义组件 |
| **AI 响应** | `.model-response` | Glassbox | ⭐⭐⭐ 类名 |
| **AI 响应后备** | `[data-test-id="model-response"]` | Glassbox | ⭐⭐⭐⭐ |
| **用户消息** | `.user-query` | Glassbox | ⭐⭐⭐ |
| **用户消息后备** | `[data-test-id="user-query"]` | Glassbox | ⭐⭐⭐⭐ |
| **对话轮次** | `ms-chat-turn` | chat-archive | ⭐⭐⭐⭐⭐ 自定义元素 |
| **思考过程** | `ms-thought-chunk` | chat-archive | ⭐⭐⭐⭐ |
| **编辑按钮** | `button[aria-label="Edit"]` | chat-archive | ⭐⭐⭐ aria |
| **编辑输入** | `ms-autosize-textarea[data-value]` | chat-archive | ⭐⭐⭐⭐ 自定义组件 |

#### 注入策略

- **输入框区域**: composer 附近
- **侧边栏**: Google 侧边栏可扩展
- **注入时机**: SPA 加载后 + MutationObserver 监听
- **Gemini 专属技巧**: 点击 Edit 按钮将消息转为可编辑的 textarea，从中读取 `data-value` 属性获取内容

#### 关键发现

1. **Google 自定义 Web Components** — `ms-*` 元素使用 Google 的内部 Web Components 系统，结构稳定但非标准
2. **`data-test-id` 风格** — Google 使用 `data-test-id`（划线分隔），不同于 OpenAI 的 `data-testid`（无分隔）
3. **编辑模式 Hack** — chat-archive 项目发现：点击 Edit 按钮 → 消息变为 `ms-autosize-textarea` → 从 `data-value` 提取内容 → 退出编辑模式。这可以用于内容提取
4. **滚动加载** — Gemini 使用双向滚动触发懒加载，需要特殊处理
5. **思考过程** — `ms-thought-chunk` 是 Gemini 特有的思考内容组件
6. **注入推荐位置**: 输入框区域、侧边栏底部
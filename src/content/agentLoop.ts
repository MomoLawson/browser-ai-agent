/**
 * AgentLoop — AI 驱动的工具执行循环
 *
 * 工作方式：
 * 1. 轮询 AI 对话，检测新的 AI 回复
 * 2. 分析 AI 回复中的工具调用模式
 * 3. 执行工具（读/写/列表）
 * 4. 将结果注入到聊天输入框，AI 继续推理
 *
 * 类似 opencode/claude code 的 Tool-Based Agent 模式，
 * 但运行在浏览器 AI 聊天网站的上下文中。
 */
import type { FileEntry } from '../shared/types'
import {
  readDirectoryStructure,
  readFile,
  writeFile,
  editFile,
  fileExists,
  verifyPermission,
  searchFiles,
  grepFiles,
} from './fileSystem'

// ============================================================
// 类型
// ============================================================

export interface ToolCall {
  type: 'read_file' | 'write_file' | 'edit_file' | 'list_files' | 'search_code'
  filePath?: string
  content?: string
  newContent?: string
  pattern?: string
  confidence: number // 0-1
}

export interface AgentLoopOptions {
  /** 获取当前对话（用于检测新消息） */
  getConversation: () => Promise<{ messages: Array<{ role: string; content: string }> }>
  /** 将文本注入到聊天输入框 */
  injectText: (text: string) => void
  /** 自动发送输入框内容 */
  sendMessage: () => void
  /** 日志回调 */
  onLog: (type: 'info' | 'success' | 'error' | 'warn', msg: string) => void
  /** 状态更新回调 */
  onStatus: (text: string) => void
}

// ============================================================
// AgentLoop 类
// ============================================================

export class AgentLoop {
  private options: AgentLoopOptions
  private dirHandle: FileSystemDirectoryHandle | null = null
  private running = false
  private lastMessageCount = 0
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private pendingTasks: Array<() => Promise<void>> = []
  private isProcessing = false

  constructor(options: AgentLoopOptions) {
    this.options = options
  }

  /** 连接项目文件夹 */
  setDirectory(handle: FileSystemDirectoryHandle): void {
    this.dirHandle = handle
    this.options.onLog('success', `📁 项目已连接，Agent 开始监听对话`)
    this.options.onStatus('已连接项目，等待 AI 指令...')
  }

  /** 断开项目 */
  clearDirectory(): void {
    this.dirHandle = null
    this.running = false
    this.options.onLog('warn', '🔌 项目已断开')
    this.options.onStatus('项目已断开')
  }

  /** 是否已连接项目 */
  get hasDirectory(): boolean {
    return this.dirHandle !== null
  }

  /** 启动监听 — skipExisting 跳过已有的消息 */
  start(skipExisting = 0): void {
    if (this.running) return
    this.running = true
    this.lastMessageCount = skipExisting
    this.options.onLog('info', `🎧 开始监听 AI 对话（跳过 ${skipExisting} 条已有消息）`)
    const pid = (this as any)._pid = Date.now()
    console.log('[BAI Agent] 轮询已启动 pid=', pid)

    // 每 2 秒轮询一次对话变化
    this.pollTimer = setInterval(() => this.poll(), 2000)
  }

  /** 停止监听 */
  stop(): void {
    if (!this.running) return
    this.running = false
    console.log('[BAI Agent] 轮询已停止')
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.options.onLog('warn', '⏹️ 监听已停止')
  }

  // ============================================================
  // 轮询
  // ============================================================

  private async poll(): Promise<void> {
    if (!this.running || !this.dirHandle) return
    if (this.isProcessing) return

    try {
      const conv = await this.options.getConversation()
      const aiMessages = conv.messages.filter((m) => m.role === 'assistant')

      if (aiMessages.length > this.lastMessageCount) {
        // 有新的 AI 消息
        const newMessages = aiMessages.slice(this.lastMessageCount)
        this.lastMessageCount = aiMessages.length
        this.options.onLog('info', `📩 检测到 ${newMessages.length} 条新 AI 消息`)

        for (const msg of newMessages) {
          console.log('[BAI Agent] AI消息内容('+msg.content.length+'字符):', msg.content.substring(0, 200))
          await this.analyzeAndExecute(msg.content)
        }
      } else if (aiMessages.length === 0 && this.lastMessageCount === 0) {
        // 首次轮询没找到消息 — 只报一次
        this.lastMessageCount = -1
        this.options.onLog('warn', `⚠️ 未检测到AI消息，正在监听中...`)
      }
    } catch {
      // 轮询失败静默处理（可能是 DOM 暂时不可用）
    }
  }

  // ============================================================
  // 工具调用分析
  // ============================================================

  private async analyzeAndExecute(content: string): Promise<void> {
    const tools = this.detectToolCalls(content)
    if (tools.length === 0) return

    let hasOutput = false
    for (const tool of tools) {
      if (tool.confidence < 0.4) continue

      this.options.onLog('info', `🔍 检测到 AI 需要操作: ${this.describeTool(tool)}`)

      try {
        await this.executeTool(tool)
        hasOutput = true
      } catch (err) {
        const msg = (err as Error).message
        this.options.onLog('error', `❌ 操作失败: ${msg}`)
        this.options.injectText(`❌ ${msg}`)
        hasOutput = true
      }
    }

    // 所有工具执行完后，统一发送一次
    if (hasOutput) {
      console.log('[BAI Agent] 所有工具执行完毕，自动发送')
      this.options.sendMessage()
    }
  }

  /**
   * 从 AI 回复中检测工具调用
   *
   * 检测模式：
   * 1. 显式标记: [read: path]、[write: path]、[list]
   * 2. 自然语言: "让我看看 src/file.ts"、"读取文件"
   * 3. 代码块 + 路径注释
   */
  private detectToolCalls(content: string): ToolCall[] {
    const tools: ToolCall[] = []

    // 也扫描代码块内部（AI 可能把工具放在 ``` 代码块里）
    const codeBlocks = content.match(/```[\s\S]*?```/g) || []
    for (const block of codeBlocks) {
      const inner = block.replace(/```\w*\n?/g, '').replace(/```/g, '').trim()
      tools.push(...this.detectPatterns(inner))
    }

    // 扫描全文
    tools.push(...this.detectPatterns(content))

    return tools
  }

  /** 从纯文本中识别工具调用 */
  private detectPatterns(content: string): ToolCall[] {
    const tools: ToolCall[] = []

    // === 模式 1：显式结构化标记 ===

    // [read: path] 或 [读取: path] — 支持一行多个
    const readMatches = content.matchAll(/\[(?:read|读取)[：:]\s*([^\]]+)\]/g)
    for (const m of readMatches) {
      const fp = m[1].trim()
      if (fp.includes('/') || fp.includes('.') || fp.includes('\\')) {
        tools.push({ type: 'read_file', filePath: fp, confidence: 0.95 })
      }
    }

    // [list] 或 [列出文件] — 在文本中出现即可
    if (/\[(?:list|列出|文件列表)\]/.test(content)) {
      tools.push({ type: 'list_files', confidence: 0.95 })
    }

    // [edit: path] old\n====\nnew [/edit] — 安全编辑（[/edit] 可选）
    const editBlock = content.match(/\[(?:edit|编辑)[：:]\s*([^\]]+)\]\s*([\s\S]*?)(?:\[\/(?:edit|编辑)\]|$)/m)
    if (editBlock) {
      console.log('[BAI Agent] 检测到 edit:', editBlock[1], '| body:', editBlock[2].substring(0, 60))
      // 找分隔符：优先匹配单独成行的 ==== 或 ---
      const sep = editBlock[2].match(/\n\s*====\s*\n|\n\s*---\s*\n|(?<=^|\n)====(?=\n|$)|\n====|====\n/)
      if (sep && sep.index !== undefined) {
        const idx = sep.index! + sep[0].indexOf('=') >= 0 ? sep.index! + sep[0].search(/[=\-]/) : sep.index!
        const old = editBlock[2].substring(0, idx).trim()
        const neu = editBlock[2].substring(idx + sep[0].replace(/^\n+|\n+$/g,'').length).trim()
        if (old) {
          tools.push({
            type: 'edit_file',
            filePath: editBlock[1].trim(),
            content: old,
            newContent: neu,
            confidence: 0.95,
          })
        }
      } else {
        // 回退：找上下文中的任意 ==== 或 ---
        const bareSep = editBlock[2].match(/====|---/)
        if (bareSep && bareSep.index !== undefined && bareSep.index > 0) {
          const idx = bareSep.index!
          const old = editBlock[2].substring(0, idx).trim()
          const neu = editBlock[2].substring(idx + bareSep[0].length).trim()
          if (old && neu) {
            tools.push({
              type: 'edit_file',
              filePath: editBlock[1].trim(),
              content: old,
              newContent: neu,
              confidence: 0.85,
            })
          }
        } else {
          console.log('[BAI Agent] edit 分隔失败')
        }
      }
    }

    // [write: path] ... [/write] — 全量写入
    const writeBlock = content.match(/\[(?:write|写入)[：:]\s*([^\]]+)\]\s*([\s\S]*?)\s*\[\/(?:write|写入)\]/)
    if (writeBlock) {
      tools.push({
        type: 'write_file',
        filePath: writeBlock[1].trim(),
        content: writeBlock[2].trim(),
        confidence: 0.95,
      })
    }

    // [search: pattern] 或 [搜索: pattern]
    const searchMatch = content.match(/\[(?:search|搜索)[：:]\s*([^\]]+)\]/)
    if (searchMatch) {
      tools.push({
        type: 'search_code',
        pattern: searchMatch[1].trim(),
        confidence: 0.9,
      })
    }

    // === 模式 2：自然语言模式（低置信度） ===

    // "让我看看/读取/打开 xxx 文件"
    const nlRead = content.match(/(?:让我看看|让我读取|读取|打开|查看)\s*[`'"](.+?)[`'"]/)
    if (nlRead && tools.length === 0) {
      tools.push({
        type: 'read_file',
        filePath: nlRead[1].trim(),
        confidence: 0.6,
      })
    }

    // "让我看看/查看目录结构/项目结构/文件列表"
    if (
      /(?:目录结构|文件列表|项目结构|项目文件)/.test(content) &&
      /(?:看看|查看|显示|列出)/.test(content) &&
      tools.length === 0
    ) {
      tools.push({ type: 'list_files', confidence: 0.5 })
    }

    // "我来修改/写入/创建 xxx 文件"
    const nlWrite = content.match(/(?:我来修改|我来写入|我来创建|写入|创建|修改)\s*[`'"](.+?)[`'"]/)
    if (nlWrite && tools.length === 0) {
      tools.push({
        type: 'write_file',
        filePath: nlWrite[1].trim(),
        confidence: 0.4,
      })
    }

    return tools
  }

  // ============================================================
  // 工具执行
  // ============================================================

  private async executeTool(tool: ToolCall): Promise<void> {
    if (!this.dirHandle) throw new Error('未连接项目')

    // 验证权限
    const ok = await verifyPermission(this.dirHandle)
    if (!ok) {
      this.options.onLog('error', '⚠️ 文件夹权限已失效，请在面板中重新选择项目')
      return
    }

    this.isProcessing = true

    try {
      switch (tool.type) {
        case 'list_files': {
          this.options.onLog('info', '📂 正在列出项目文件...')
          const tree = await readDirectoryStructure(this.dirHandle)
          const summary = this.formatFileTree(tree)
          this.options.injectText(summary)
          this.options.onLog('success', `✅ 已列出 ${countFiles(tree)} 个文件`)
          break
        }

        case 'read_file': {
          if (!tool.filePath) throw new Error('未指定文件路径')
          this.options.onLog('info', `📖 正在读取: ${tool.filePath}`)
          const content = await readFile(this.dirHandle, tool.filePath)
          const injected = `\`\`\`\n// ${tool.filePath}\n${content}\n\`\`\`\n`
          this.options.injectText(injected)
          this.options.onLog('success', `✅ 已读取 ${tool.filePath} (${content.length} 字符)`)
          break
        }

        case 'edit_file': {
          if (!tool.filePath || !tool.content || !tool.newContent) throw new Error('缺少路径或内容')
          this.options.onLog('info', `✏️ 正在编辑: ${tool.filePath}`)
          await editFile(this.dirHandle, tool.filePath, tool.content, tool.newContent)
          const result = `✅ 文件已编辑: ${tool.filePath}`
          this.options.injectText(result)
          this.options.onLog('success', `✅ 已编辑 ${tool.filePath}`)
          break
        }

        case 'write_file': {
          if (!tool.filePath || tool.content === undefined) throw new Error('未指定文件路径或内容')
          const exists = await fileExists(this.dirHandle, tool.filePath)
          if (exists) {
            throw new Error(
              `文件 ${tool.filePath} 已存在。请使用 [edit: ${tool.filePath}] 修改，` +
              `先 [read: ${tool.filePath}] 确认内容后再 edit。`
            )
          }
          this.options.onLog('info', `📝 正在创建: ${tool.filePath}`)
          await writeFile(this.dirHandle, tool.filePath, tool.content)
          const result = `✅ 文件已创建: ${tool.filePath}`
          this.options.injectText(result)
          this.options.onLog('success', `✅ 已创建 ${tool.filePath}`)
          break
        }

        case 'search_code': {
          if (!tool.pattern) throw new Error('未指定搜索模式')
          // 判断是文件名搜索还是内容搜索
          if (tool.pattern.includes('*') || tool.pattern.includes('?') || /\.\w+$/.test(tool.pattern)) {
            // glob 模式 → 文件名搜索
            this.options.onLog('info', `🔍 搜索文件: ${tool.pattern}`)
            const files = await searchFiles(this.dirHandle, tool.pattern)
            const result = files.length > 0
              ? `找到 ${files.length} 个匹配文件:\n${files.map(f=>`  ${f}`).join('\n')}`
              : `未找到匹配 "${tool.pattern}" 的文件。`
            this.options.injectText(result)
            this.options.onLog('success', `搜索完成: ${files.length} 个文件`)
          } else {
            // 内容搜索 (grep)
            this.options.onLog('info', `🔎 grep: ${tool.pattern}`)
            const result = await grepFiles(this.dirHandle, tool.pattern)
            this.options.injectText(result)
            this.options.onLog('success', 'grep 完成')
          }
          break
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  // ============================================================
  // 格式化
  // ============================================================

  private formatFileTree(entries: FileEntry[]): string {
    const lines: string[] = ['📁 项目文件结构:\n```']
    this.buildTreeLines(entries, lines, '')
    lines.push('```')
    return lines.join('\n')
  }

  private buildTreeLines(entries: FileEntry[], lines: string[], prefix: string): void {
    for (let i = 0; i < entries.length; i++) {
      const isLast = i === entries.length - 1
      const connector = isLast ? '└── ' : '├── '
      lines.push(`${prefix}${connector}${entries[i].name}${entries[i].kind === 'directory' ? '/' : ''}`)
      if (entries[i].children) {
        const childPrefix = prefix + (isLast ? '    ' : '│   ')
        this.buildTreeLines(entries[i].children!, lines, childPrefix)
      }
    }
  }

  private describeTool(tool: ToolCall): string {
    switch (tool.type) {
      case 'read_file': return `读取 ${tool.filePath}`
      case 'write_file': return `写入 ${tool.filePath}`
      case 'edit_file': return `编辑 ${tool.filePath}`
      case 'list_files': return '列出项目文件'
      case 'search_code': return `搜索 ${tool.pattern}`
    }
  }

  /** 获取当前 AI 消息数（用于重置计数器） */
  getMessageCount(): number {
    return this.lastMessageCount
  }

  /** 重置消息计数器（切换对话时使用） */
  resetMessageCount(): void {
    this.lastMessageCount = 0
  }
}

function countFiles(entries: FileEntry[]): number {
  let c = 0
  for (const e of entries) {
    if (e.kind === 'file') c++
    if (e.children) c += countFiles(e.children)
  }
  return c
}

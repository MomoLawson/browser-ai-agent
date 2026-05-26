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
import { countFiles } from './fileSystem'
import { loadSettings, resolveLang, t, type Lang } from './settings'
import { computeDiff, formatDiffText } from './diff'
import { loadTodos, addTodo, toggleTodo, removeTodo, clearTodos, formatTodoText, type TodoItem } from './todo'

// ============================================================
// 类型
// ============================================================

export interface ToolCall {
  type: 'read_file' | 'write_file' | 'edit_file' | 'list_files' | 'search_code' | 'grep_code' | 'todo'
  filePath?: string
  content?: string
  newContent?: string
  pattern?: string
  confidence: number // 0-1
  // todo 相关
  todoAction?: 'list' | 'add' | 'done' | 'remove' | 'clear'
  todoText?: string
  todoId?: number
}

export interface AgentLoopOptions {
  lang?: Lang
  /** 获取当前对话（用于检测新消息） */
  getConversation: () => Promise<{ messages: Array<{ role: string; content: string }> }>
  /** 将文本注入到聊天输入框 */
  injectText: (text: string) => void
  /** 自动发送输入框内容 */
  sendMessage: () => void
  /** 日志回调 */
  onLog: (type: 'info' | 'success' | 'error' | 'warn', msg: string) => void
  /** 工具执行结果回调（用于渲染 diff） */
  onToolResult?: (result: { type: 'edit' | 'write'; filePath: string; diff: string }) => void
  /** todo 结果回调（用于渲染 todo 列表） */
  onTodoResult?: (result: { action: string; todos: TodoItem[]; message: string }) => void
  /** 状态更新回调 */
  onStatus: (text: string) => void
}

// ============================================================
// AgentLoop 类
// ============================================================

export class AgentLoop {
  private options: AgentLoopOptions
  readonly lang: Lang
  private dirHandle: FileSystemDirectoryHandle | null = null
  private running = false
  private lastMessageCount = 0
  private lastContentHash = ''
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private pendingTasks: Array<() => Promise<void>> = []
  private isProcessing = false
  private _processedToolKeys = new Set<string>()
  private _lastProcessedMsgIdx = -1
  private _msgSent = new Set<number>()

  constructor(options: AgentLoopOptions) {
    this.options = options
    this.lang = options.lang || resolveLang(loadSettings())
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

      // 内容指纹（应对消息数不变但内容变的情况）
      const currentHash = aiMessages.map(m=>m.content).join('|').length.toString()
      const contentChanged = currentHash !== this.lastContentHash

      if (aiMessages.length > this.lastMessageCount || contentChanged) {
        // 获取新消息：增量的新消息 或 内容变化的最后一条
        let startIdx: number
        let newMessages: typeof aiMessages
        if (aiMessages.length > this.lastMessageCount) {
          startIdx = this.lastMessageCount
          newMessages = aiMessages.slice(startIdx)
          this.lastMessageCount = aiMessages.length
        } else {
          // 消息数不变但内容变了（流式更新）→ 重新处理最后一条
          startIdx = aiMessages.length - 1
          newMessages = aiMessages.slice(-1)
        }
        this.lastContentHash = currentHash
        if (newMessages.length > 0) this.options.onLog('info', `📩 检测到 AI 新消息`)

        for (let i = 0; i < newMessages.length; i++) {
          const msg = newMessages[i]
          const msgIdx = startIdx + i
          console.log('[BAI Agent] AI消息内容('+msg.content.length+'字符, idx='+msgIdx+'):', msg.content.substring(0, 200))
          await this.analyzeAndExecute(msg.content, msgIdx)
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

  /** 返回值表示是否执行了任何工具（含失败） */
  private async analyzeAndExecute(content: string, msgIdx = -1): Promise<boolean> {
    if (content.length < 5) return false

    // 已回复过的消息跳过（流式内容增长但已发送过回复则不再处理）
    if (msgIdx >= 0 && this._msgSent.has(msgIdx)) {
      console.log('[BAI] 消息', msgIdx, '已回复过，跳过')
      return false
    }

    const tools = this.detectToolCalls(content)
    if (tools.length === 0) {
      if (content.includes('[list]') || content.includes('[read:') || content.includes('[edit:') || content.includes('[todo]')) {
        console.log('[BAI] ⚠️ 工具标记存在但 detectToolCalls 未识别:', JSON.stringify(content.substring(0, 300)))
      }
      return false
    }

    // 锁定整个分析—执行—发送周期，防止并发 poll 闯入
    this.isProcessing = true

    try {
      // 每条消息独立追踪已执行的工具（流式输出时内容增长但工具不变则跳过）
      if (msgIdx !== this._lastProcessedMsgIdx) {
        this._processedToolKeys.clear()
        this._lastProcessedMsgIdx = msgIdx
      }

      let hasOutput = false
      for (const tool of tools) {
        if (tool.confidence < 0.6) continue

        // 单个工具粒度去重
        const key = this._toolKey(tool)
        if (this._processedToolKeys.has(key)) {
          console.log('[BAI] 跳过已执行工具:', key)
          continue
        }
        this._processedToolKeys.add(key)

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
        if (this._msgSent.has(msgIdx)) {
          console.log('[BAI Agent] 本消息已发送过，跳过再次发送')
        } else {
          console.log('[BAI Agent] 所有工具执行完毕，自动发送')
          this.options.sendMessage()
          if (msgIdx >= 0) this._msgSent.add(msgIdx)
        }
      }
      return hasOutput
    } finally {
      this.isProcessing = false
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
    console.log('[BAI] detectToolCalls, len='+content.length+', contains [list]:', content.includes('[list]'))

    // 也扫描代码块内部（AI 可能把工具放在 ``` 代码块里）
    const codeBlocks = content.match(/```[\s\S]*?```/g) || []
    for (const block of codeBlocks) {
      // 提取语言标记（``` 后的整行，含空格）和代码块内容
      const langMatch = block.match(/```([^\n]+)\n?/)
      const lang = langMatch ? langMatch[1].toLowerCase() : ''
      const inner = block.replace(/```[^\n]*\n?/g, '').replace(/```/g, '').trim()

      // Markdown 渲染后语言标记可能是 `[edit: path]`、`[list]`（作为 info string）
      if (lang.startsWith('[')) {
        // 带路径: [edit: path] [read: path] [write: path] [search: ...] [grep: ...]
        const toolInTag = lang.match(/\[(edit|read|write|search|grep|搜索|搜索内容)[：:]\s*([^\]]+)\]/)
        if (toolInTag) {
          const fp = toolInTag[2].trim()
          const t = toolInTag[1]
          if (t === 'edit') tools.push(...this.detectPatterns(`[edit: ${fp}]\n${inner}\n[/edit]`))
          else if (t === 'read') tools.push({ type: 'read_file', filePath: fp, confidence: 0.9 })
          else if (t === 'write') tools.push(...this.detectPatterns(`[write: ${fp}]\n${inner}`))
          else if (t === 'search' || t === '搜索') { if (fp.length >= 2) tools.push({ type: 'search_code', pattern: fp, confidence: 0.9 }) }
          else if (t === 'grep' || t === '搜索内容') { if (fp.length >= 2) tools.push({ type: 'grep_code', pattern: fp, confidence: 0.9 }) }
          continue
        }
        // 无路径的标记: [list]
        if (/\[(?:list|列出|文件列表)\]/.test(lang)) {
          tools.push({ type: 'list_files', confidence: 0.95 })
          continue
        }
      }

      // 标准语言标记：edit:path、read:path
      const tagFp = lang.match(/^(edit|read|write)[：:]\s*(.+)/)
      if (tagFp) {
        const [_, tool, fp] = tagFp
        if (tool === 'edit') tools.push(...this.detectPatterns(`[edit: ${fp}]\n${inner}\n[/edit]`))
        else if (tool === 'read') tools.push({ type: 'read_file', filePath: fp.trim(), confidence: 0.9 })
        else if (tool === 'write') tools.push(...this.detectPatterns(`[write: ${fp}]\n${inner}`))
        continue
      }

      // 一般代码块，用 detectPatterns 检查内容
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

    // [read: path] 或 [读取: path] — 支持一行多个，路径至少 3 字符
    const readMatches = content.matchAll(/\[(?:read|读取)[：:]\s*([^\]]+)\]/g)
    for (const m of readMatches) {
      const fp = m[1].trim()
      if (fp.length >= 3 && (fp.includes('/') || fp.includes('.') || fp.includes('\\'))) {
        tools.push({ type: 'read_file', filePath: fp, confidence: 0.95 })
      }
    }

    // [grep: pattern] — 文件内容搜索
    const grepMatches = content.matchAll(/\[(?:grep|搜索内容)[：:]\s*(.+?)\]/g)
    for (const grepMatch of grepMatches) {
      const p = grepMatch[1].trim()
      if (p.length >= 2) tools.push({ type: 'grep_code', pattern: p, confidence: 0.95 })
    }

    // [list] 或 [列出文件]（可出现在回复中的任意位置）
    if (/\[(?:list|列出|文件列表)\]/.test(content)) {
      tools.push({ type: 'list_files', confidence: 0.95 })
    }

    // [todo] — 列出 todos
    if (/\[todo\]/.test(content)) {
      console.log('[BAI] ✅ 检测到 [todo]')
      tools.push({ type: 'todo', todoAction: 'list', confidence: 0.95 })
    }

    // [todo: action ...]
    const todoMatches = content.matchAll(/\[todo[：:]\s*([^\]]+)\]/g)
    for (const tm of todoMatches) {
      const cmd = tm[1].trim()
      // [todo: add "text"]
      const addM = cmd.match(/^(?:add|添加)\s+"([^"]+)"|^(?:add|添加)\s+'([^']+)'|^(?:add|添加)\s+(.+)/)
      if (addM) {
        const text = addM[1] || addM[2] || addM[3]
        if (text && text.length >= 1) {
          tools.push({ type: 'todo', todoAction: 'add', todoText: text, confidence: 0.95 })
          continue
        }
      }
      // [todo: done N] / [todo: check N] / [todo: complete N]
      const doneM = cmd.match(/^(?:done|check|complete|完成)\s+(\d+)/)
      if (doneM) {
        tools.push({ type: 'todo', todoAction: 'done', todoId: parseInt(doneM[1]), confidence: 0.95 })
        continue
      }
      // [todo: remove N] / [todo: rm N] / [todo: delete N] / [todo: 删除 N]
      const rmM = cmd.match(/^(?:remove|rm|delete|删除)\s+(\d+)/)
      if (rmM) {
        tools.push({ type: 'todo', todoAction: 'remove', todoId: parseInt(rmM[1]), confidence: 0.95 })
        continue
      }
      // [todo: clear] / [todo: 清除]
      if (/^(?:clear|清除)$/.test(cmd)) {
        tools.push({ type: 'todo', todoAction: 'clear', confidence: 0.95 })
        continue
      }
      // 其他文字当作 list
      tools.push({ type: 'todo', todoAction: 'list', confidence: 0.9 })
    }

    // [edit: path] old\n====\nnew [/edit] — 必须包含 [/edit] 闭包（防止流式输出时误匹配）
    const editMatches = content.matchAll(/\[(?:edit|编辑)[：:]\s*([^\]]+)\]\s*([\s\S]*?)(?:\[\/(?:edit|编辑)\])/g)
    for (const editBlock of editMatches) {
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

    // [write: path] ... [/write] — 必须包含 [/write] 闭包（防止流式输出时写入不完整内容）
    const writeMatches = content.matchAll(/\[(?:write|写入)[：:]\s*([^\]]+)\]\s*([\s\S]*?)(?:\[\/(?:write|写入)\]|(?=\[))/g)
    for (const writeBlock of writeMatches) {
      tools.push({
        type: 'write_file',
        filePath: writeBlock[1].trim(),
        content: writeBlock[2].trim(),
        confidence: 0.95,
      })
    }

    // [search: pattern] 或 [搜索: pattern]（pattern 至少 2 字符）
    const searchMatches = content.matchAll(/\[(?:search|搜索)[：:]\s*([^\]]+)\]/g)
    for (const searchMatch of searchMatches) {
      const p = searchMatch[1].trim()
      if (p.length >= 2) {
        tools.push({ type: 'search_code', pattern: p, confidence: 0.9 })
      }
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

    switch (tool.type) {
        case 'list_files': {
          this.options.onLog('info', '📂 正在列出项目文件...')
          const tree = await readDirectoryStructure(this.dirHandle)
          const summary = this.formatFileTree(tree)
          this.options.injectText(`[Tool: List]\n\`\`\`\n${stripMarkdownTicks(summary)}\n\`\`\`\n`)
          this.options.onLog('success', `✅ 已列出 ${countFiles(tree)} 个文件`)
          break
        }

        case 'read_file': {
          if (!tool.filePath) throw new Error('未指定文件路径')
          this.options.onLog('info', `📖 正在读取: ${tool.filePath}`)
          const content = await readFile(this.dirHandle, tool.filePath)
          this.options.injectText(`[Tool: Read]\n\`${tool.filePath}\`\n\`\`\`\n${content}\n\`\`\`\n`)
          this.options.onLog('success', `✅ 已读取 ${tool.filePath} (${content.length} 字符)`)
          break
        }

        case 'edit_file': {
          if (!tool.filePath || !tool.content || !tool.newContent) throw new Error('缺少路径或内容')
          this.options.onLog('info', `✏️ 正在编辑: ${tool.filePath}`)
          await editFile(this.dirHandle, tool.filePath, tool.content, tool.newContent)
          const hunks = computeDiff(tool.content, tool.newContent)
          const diffText = formatDiffText(hunks)
          this.options.injectText(`[Tool: Edit]\n\`${tool.filePath}\` ✅ Edited`)
          this.options.onToolResult?.({ type: 'edit', filePath: tool.filePath, diff: diffText })
          this.options.onLog('success', `✅ 已编辑 ${tool.filePath}`)
          break
        }

        case 'write_file': {
          if (!tool.filePath || tool.content === undefined) throw new Error('未指定文件路径或内容')
          const exists = await fileExists(this.dirHandle, tool.filePath)
          if (exists) {
            throw new Error(
              `\`${tool.filePath}\` 已存在。请使用 [edit: ${tool.filePath}] 修改，` +
              `先 [read: ${tool.filePath}] 确认内容后再 edit。`
            )
          }
          this.options.onLog('info', `📝 正在创建: ${tool.filePath}`)
          await writeFile(this.dirHandle, tool.filePath, tool.content)
          const diffBody = tool.content.split('\n').map(l => `+${l}`).join('\n')
          this.options.injectText(`[Tool: Write]\n\`${tool.filePath}\` ✅ Created`)
          this.options.onToolResult?.({ type: 'write', filePath: tool.filePath, diff: diffBody })
          this.options.onLog('success', `✅ 已创建 ${tool.filePath}`)
          break
        }

        case 'search_code': {
          if (!tool.pattern) throw new Error('未指定搜索模式')
          this.options.onLog('info', `🔍 搜索文件: ${tool.pattern}`)
          const files = await searchFiles(this.dirHandle, tool.pattern)
          const result = files.length > 0
            ? `[Tool: Search]\nPattern: ${tool.pattern}\n${files.map(f=>`  ${f}`).join('\n')}`
            : `[Tool: Search]\nPattern: ${tool.pattern}\n(no matches)`
          this.options.injectText(result)
          this.options.onLog('success', `搜索完成: ${files.length} 个文件`)
          break
        }

        case 'grep_code': {
          if (!tool.pattern) throw new Error('未指定搜索模式')
          this.options.onLog('info', `🔎 grep: ${tool.pattern}`)
          const raw = await grepFiles(this.dirHandle, tool.pattern)
          this.options.injectText(`[Tool: Grep]\nPattern: ${tool.pattern}\n${raw}`)
          this.options.onLog('success', 'grep 完成')
          break
        }

        case 'todo': {
          const project = this.dirHandle.name
          const action = tool.todoAction || 'list'
          let todos: TodoItem[]
          let msg = ''
          switch (action) {
            case 'add': {
              if (!tool.todoText) throw new Error('todo 缺少描述文字')
              todos = addTodo(project, tool.todoText)
              msg = `✅ To-Do added: ${tool.todoText}`
              break
            }
            case 'done': {
              if (!tool.todoId) throw new Error('todo 缺少编号')
              todos = toggleTodo(project, tool.todoId)
              const t = todos.find(x => x.id === tool.todoId)
              msg = t?.done ? `✅ To-Do #${tool.todoId} completed` : `↩️ To-Do #${tool.todoId} reopened`
              break
            }
            case 'remove': {
              if (!tool.todoId) throw new Error('todo 缺少编号')
              todos = removeTodo(project, tool.todoId)
              msg = `🗑️ To-Do #${tool.todoId} removed`
              break
            }
            case 'clear': {
              todos = clearTodos(project)
              msg = '🗑️ All todos cleared'
              break
            }
            default: {
              todos = loadTodos(project)
              msg = todos.length > 0 ? `📋 ${todos.length} todo(s)` : '📋 No todos'
              break
            }
          }
          const text = action === 'list' ? '\n' + formatTodoText(todos) : ''
          this.options.injectText(`[Tool: Todo] ${msg}${text}`)
          this.options.onTodoResult?.({ action, todos, message: msg })
          this.options.onLog('success', msg)
          break
        }
    }
  }

  // ============================================================
  // 格式化
  // ============================================================

  private formatFileTree(entries: FileEntry[]): string {
    if (entries.length === 0) return '(empty)'
    const lines: string[] = []
    this.buildTreeLines(entries, lines, '')
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
      case 'search_code': return `搜索文件 ${tool.pattern}`
      case 'grep_code': return `搜索内容 ${tool.pattern}`
      case 'todo': return `To-Do: ${tool.todoAction || 'list'}`
    }
  }

  /** 生成单个工具的唯一 key（用于流式去重） */
  private _toolKey(t: ToolCall): string {
    let k = t.type
    if (t.type === 'todo') {
      k += ':' + (t.todoAction || 'list')
      if (t.todoId) k += ':' + t.todoId
      if (t.todoText) k += ':' + t.todoText
    } else if (t.filePath) {
      k += ':' + t.filePath
    } else if (t.pattern) {
      k += ':' + t.pattern
    }
    return k
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

/** 移除 markdown 代码块标记（避免嵌套 ```） */
function stripMarkdownTicks(s: string): string {
  return s.replace(/`{3,}/g, '')
}

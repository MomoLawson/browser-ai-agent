/**
 * Agent 执行引擎
 *
 * 基于 Tool-Based Agent 模式，参考 claude_code_src 和 opencode 的设计。
 *
 * 架构：
 *   User Input → Agent Loop → Tool Execution → File System → Result
 */
import type { FileEntry, AgentStatus, ToolContext } from '../shared/types'
import { selectProjectFolder, verifyPermission, readDirectoryStructure, readFile, writeFile, countFiles } from '../content/fileSystem'

// ============================================================
// Tool 定义
// ============================================================

interface Tool<I = unknown, O = unknown> {
  name: string
  description: string
  execute(input: I, ctx: ToolContext): Promise<O>
}

type AgentLogEntry = {
  type: 'info' | 'success' | 'error' | 'warn'
  message: string
  timestamp: number
}

// ============================================================
// Agent 状态
// ============================================================

export interface AgentState {
  status: AgentStatus
  dirHandle: FileSystemDirectoryHandle | null
  projectPath: string
  fileTree: FileEntry[]
  logs: AgentLogEntry[]
}

// ============================================================
// Tool 注册表
// ============================================================

const tools: Tool[] = [
  {
    name: 'read_file',
    description: '读取项目中的文件内容',
    async execute(input: { file_path: string }, ctx: ToolContext) {
      if (!ctx.dirHandle) throw new Error('未选择项目文件夹')
      return { content: await readFile(ctx.dirHandle, input.file_path) }
    },
  },
  {
    name: 'write_file',
    description: '写入内容到项目文件',
    async execute(input: { file_path: string; content: string }, ctx: ToolContext) {
      if (!ctx.dirHandle) throw new Error('未选择项目文件夹')
      await writeFile(ctx.dirHandle, input.file_path, input.content)
      return { success: true, path: input.file_path }
    },
  },
  {
    name: 'list_files',
    description: '列出项目目录结构',
    async execute(_input: unknown, ctx: ToolContext) {
      if (!ctx.dirHandle) throw new Error('未选择项目文件夹')
      const tree = await readDirectoryStructure(ctx.dirHandle)
      return { files: tree }
    },
  },
  {
    name: 'get_project_info',
    description: '获取项目信息',
    async execute(_input: unknown, ctx: ToolContext) {
      return {
        path: ctx.projectPath,
        fileCount: countFiles(await readDirectoryStructure(
          ctx.dirHandle!,
        )),
      }
    },
  },
]

// ============================================================
// Agent Runner
// ============================================================

export class AgentRunner {
  private state: AgentState = {
    status: 'idle',
    dirHandle: null,
    projectPath: '',
    fileTree: [],
    logs: [],
  }

  private logChangeListeners: Array<(logs: AgentLogEntry[]) => void> = []
  private statusChangeListeners: Array<(status: AgentStatus) => void> = []

  get status(): AgentStatus {
    return this.state.status
  }

  get logs(): AgentLogEntry[] {
    return this.state.logs
  }

  get projectPath(): string {
    return this.state.projectPath
  }

  get fileTree(): FileEntry[] {
    return this.state.fileTree
  }

  onLogChanged(listener: (logs: AgentLogEntry[]) => void): () => void {
    this.logChangeListeners.push(listener)
    return () => {
      this.logChangeListeners = this.logChangeListeners.filter((l) => l !== listener)
    }
  }

  onStatusChanged(listener: (status: AgentStatus) => void): () => void {
    this.statusChangeListeners.push(listener)
    return () => {
      this.statusChangeListeners = this.statusChangeListeners.filter((l) => l !== listener)
    }
  }

  // ============================================================
  // 项目选择
  // ============================================================

  async selectProject(): Promise<boolean> {
    const result = await selectProjectFolder()
    if (!result) return false

    this.state.dirHandle = result.handle
    this.state.projectPath = result.name
    this.state.fileTree = await readDirectoryStructure(result.handle)
    this.addLog('success', `已选择项目: ${result.name}`)
    this.setStatus('idle')
    return true
  }

  // ============================================================
  // 工具执行
  // ============================================================

  async executeTool(toolName: string, input: unknown): Promise<unknown> {
    const tool = tools.find((t) => t.name === toolName)
    if (!tool) throw new Error(`未知工具: ${toolName}`)

    if (!this.state.dirHandle) {
      throw new Error('请先选择项目文件夹')
    }

    // 验证权限
    const hasPermission = await verifyPermission(this.state.dirHandle)
    if (!hasPermission) {
      throw new Error('文件夹权限已失效，请重新选择')
    }

    this.addLog('info', `执行工具: ${toolName}`)
    const ctx: ToolContext = {
      dirHandle: this.state.dirHandle,
      projectPath: this.state.projectPath,
    }

    try {
      const result = await tool.execute(input, ctx)
      this.addLog('success', `工具 ${toolName} 执行成功`)
      return result
    } catch (err) {
      this.addLog('error', `工具 ${toolName} 执行失败: ${(err as Error).message}`)
      throw err
    }
  }

  // ============================================================
  // Agent 循环（简化版）
  // ============================================================

  async runAgent(instruction: string): Promise<void> {
    if (this.state.status === 'running') {
      throw new Error('Agent 正在运行中')
    }

    if (!this.state.dirHandle) {
      throw new Error('请先选择项目文件夹')
    }

    this.setStatus('running')
    this.addLog('info', `开始执行: ${instruction}`)

    try {
      // 简易 Agent 循环 — 后续可扩展为 LLM 驱动的多步执行
      // 目前支持简单的命令解析
      const cmd = parseInstruction(instruction)
      switch (cmd.action) {
        case 'list':
          this.state.fileTree = await readDirectoryStructure(this.state.dirHandle)
          this.addLog('success', `项目文件结构已更新（${this.state.fileTree.length} 个条目）`)
          break
        case 'read':
          if (cmd.filePath) {
            const content = await readFile(this.state.dirHandle, cmd.filePath)
            this.addLog('success', `已读取文件: ${cmd.filePath} (${content.length} 字符)`)
          }
          break
        case 'write':
          if (cmd.filePath && cmd.content !== undefined) {
            await writeFile(this.state.dirHandle, cmd.filePath, cmd.content)
            this.addLog('success', `已写入文件: ${cmd.filePath}`)
          }
          break
        default:
          this.addLog('warn', `无法识别的指令: "${instruction}"`)
      }

      this.setStatus('completed')
    } catch (err) {
      this.addLog('error', `Agent 执行失败: ${(err as Error).message}`)
      this.setStatus('error')
    }
  }

  async stopAgent(): Promise<void> {
    if (this.state.status === 'running') {
      this.setStatus('idle')
      this.addLog('warn', 'Agent 已停止')
    }
  }

  // ============================================================
  // 内部状态管理
  // ============================================================

  private setStatus(status: AgentStatus): void {
    this.state.status = status
    this.statusChangeListeners.forEach((l) => l(status))
  }

  private addLog(type: AgentLogEntry['type'], message: string): void {
    const entry: AgentLogEntry = { type, message, timestamp: Date.now() }
    this.state.logs.push(entry)
    this.logChangeListeners.forEach((l) => l(this.state.logs))
  }
}

// ============================================================
// 简易指令解析器
// ============================================================

interface ParsedInstruction {
  action: 'list' | 'read' | 'write' | 'unknown'
  filePath?: string
  content?: string
}

function parseInstruction(instruction: string): ParsedInstruction {
  const lower = instruction.toLowerCase().trim()

  if (lower === 'list' || lower === 'ls' || lower === 'tree' || lower.startsWith('列出') || lower.startsWith('查看')) {
    return { action: 'list' }
  }

  const readMatch = lower.match(/^(?:read|cat|查看|读取)\s+(\S+)/)
  if (readMatch) {
    return { action: 'read', filePath: readMatch[1] }
  }

  const writeMatch = instruction.match(/^(?:write|写入|创建|修改)\s+(\S+)\s*[：:]\s*(.+)/s)
  if (writeMatch) {
    return { action: 'write', filePath: writeMatch[1], content: writeMatch[2] }
  }

  return { action: 'unknown' }
}

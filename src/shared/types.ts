// ============================================================
// 类型定义
// ============================================================

/** 支持的 AI 平台 */
export type AIPlatform =
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'deepseek'
  | 'kimi'
  | 'doubao'
  | 'yuanbao'

/** Agent 运行模式 */
export type AgentMode = 'build' | 'plan'

/** Agent 执行状态 */
export type AgentStatus = 'idle' | 'running' | 'completed' | 'error'

/** 文件系统条目 */
export interface FileEntry {
  name: string
  path: string
  kind: 'file' | 'directory'
  children?: FileEntry[]
}

/** 对话内容 */
export interface Conversation {
  platform: AIPlatform
  messages: Message[]
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/** 工具执行输入/输出 */
export interface ToolContext {
  dirHandle: FileSystemDirectoryHandle | null
  projectPath: string
}

export interface ToolDefinition<I, O> {
  name: string
  description: string
  execute(input: I, ctx: ToolContext): Promise<O>
}

// ============================================================
// 消息通信协议
// ============================================================

export type AgentMessageType =
  | 'READ_FILE'
  | 'WRITE_FILE'
  | 'LIST_FILES'
  | 'DELETE_FILE'
  | 'CREATE_DIRECTORY'
  | 'GET_PROJECT_INFO'
  | 'AGENT_START'
  | 'AGENT_STOP'
  | 'AGENT_STATUS'
  | 'SELECT_PROJECT'
  | 'EXECUTE_TOOL'
  | 'UPDATE_SETTINGS'
  | 'WEB_SEARCH'
  | 'WEB_FETCH'

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export interface AgentMessage {
  type: AgentMessageType
  id: string
  payload: unknown
}

export interface AgentResponse {
  id: string
  success: boolean
  data?: unknown
  error?: string
}

// ============================================================
// UI 事件
// ============================================================

export interface UIState {
  status: AgentStatus
  projectPath: string | null
  fileCount: number
  lastAction: string | null
  error: string | null
}

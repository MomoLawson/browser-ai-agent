/**
 * Chrome Extension 消息处理器
 *
 * 从 index.ts 中剥离，提供回调式 API。
 * Userscript 模式下不注册（chrome.runtime 不可用）。
 */
import type { AgentMessage, AgentResponse, FileEntry, SearchResult } from '../shared/types'

export interface ExtensionActions {
  selectProject: () => Promise<{ name: string; fileCount: number; tree: FileEntry[] } | null>
  getProjectInfo: () => Promise<{ path: string; fileCount: number }>
  executeCommand: (cmd: string) => Promise<{
    log: Array<{ type: string; msg: string }>
    tree?: FileEntry[]
    projectInfo?: { name: string; fileCount: number }
  }>
  webSearch?: (query: string) => Promise<SearchResult[]>
  webFetch?: (url: string, maxLength?: number) => Promise<string>
}

export function registerExtensionHandler(actions: ExtensionActions): () => void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
    return () => {}
  }

  const listener = (
    msg: AgentMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (resp: AgentResponse) => void,
  ) => {
    handleMessage(msg as AgentMessage, actions)
      .then(sendResponse)
      .catch((err) => sendResponse({ id: msg.id, success: false, error: err.message }))
    return true // 异步响应
  }

  chrome.runtime.onMessage.addListener(listener)
  return () => chrome.runtime.onMessage.removeListener(listener)
}

async function handleMessage(
  msg: AgentMessage,
  actions: ExtensionActions,
): Promise<AgentResponse> {
  const base = { id: msg.id }

  switch ((msg as any).type) {
    case 'SELECT_PROJECT': {
      const result = await actions.selectProject()
      return { ...base, success: true, data: result }
    }

    case 'GET_PROJECT_INFO': {
      const info = await actions.getProjectInfo()
      return { ...base, success: true, data: info }
    }

    case 'EXECUTE_COMMAND': {
      const cmd = (msg.payload as { cmd?: string })?.cmd || ''
      const result = await actions.executeCommand(cmd)
      return { ...base, success: true, data: result }
    }

    case 'WEB_SEARCH': {
      if (!actions.webSearch) return { ...base, success: false, error: 'webSearch not implemented' }
      const { query } = msg.payload as { query: string }
      const results = await actions.webSearch(query)
      return { ...base, success: true, data: results }
    }

    case 'WEB_FETCH': {
      if (!actions.webFetch) return { ...base, success: false, error: 'webFetch not implemented' }
      const { url, maxLength } = msg.payload as { url: string; maxLength?: number }
      const text = await actions.webFetch(url, maxLength)
      return { ...base, success: true, data: text }
    }

    default:
      return { ...base, success: false, error: `未知消息类型: ${msg.type}` }
  }
}

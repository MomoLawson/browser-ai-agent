/**
 * Background Service Worker 入口
 *
 * Chrome Extension MV3 模式下运行。
 * Userscript 模式下不加载此文件。
 */
import { listenForMessages } from '../shared/messaging'
import type { AgentMessage, AgentResponse } from '../shared/types'
import { AgentRunner } from './agentRunner'

const agent = new AgentRunner()

// 监听来自 Content Script 的消息
const cleanup = listenForMessages(async (msg: AgentMessage): Promise<AgentResponse> => {
  const baseResponse = { id: msg.id }

  try {
    switch (msg.type) {
      case 'SELECT_PROJECT':
      // 在 popup 中处理
      // eslint-disable-next-line no-case-declarations
      // const selected = await agent.selectProject()
      // return { ...baseResponse, success: true, data: { selected } }

      case 'GET_PROJECT_INFO':
        return {
          ...baseResponse,
          success: true,
          data: {
            path: agent.projectPath,
            status: agent.status,
            fileCount: agent.fileTree.length,
          },
        }

      case 'EXECUTE_TOOL': {
        const { toolName, input } = msg.payload as { toolName: string; input: unknown }
        const result = await agent.executeTool(toolName, input)
        return { ...baseResponse, success: true, data: result }
      }

      case 'AGENT_START': {
        const { instruction } = msg.payload as { instruction: string }
        await agent.runAgent(instruction)
        return { ...baseResponse, success: true, data: { status: agent.status } }
      }

      case 'AGENT_STOP':
        await agent.stopAgent()
        return { ...baseResponse, success: true, data: { status: agent.status } }

      case 'AGENT_STATUS':
        return {
          ...baseResponse,
          success: true,
          data: {
            status: agent.status,
            logs: agent.logs,
          },
        }

      case 'WEB_SEARCH': {
        const { query } = msg.payload as { query: string }
        const results = await webSearch(query)
        return { ...baseResponse, success: true, data: results }
      }

      case 'WEB_FETCH': {
        const { url, maxLength } = msg.payload as { url: string; maxLength?: number }
        const text = await webFetch(url, maxLength)
        return { ...baseResponse, success: true, data: text }
      }

      default:
        return { ...baseResponse, success: false, error: `未知消息类型: ${msg.type}` }
    }
  } catch (err) {
    return { ...baseResponse, success: false, error: (err as Error).message }
  }
})

// ============================================================
// Web Search (DuckDuckGo HTML)
// ============================================================

interface SearchResult { title: string; url: string; snippet: string }

async function webSearch(query: string): Promise<SearchResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  const html = await resp.text()
  const results: SearchResult[] = []
  const blocks = html.split(/class="[^"]*result__body[^"]*"/)
  for (let i = 1; i < blocks.length && results.length < 8; i++) {
    const b = blocks[i]
    const titleMatch = b.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/)
    const hrefMatch = b.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"/)
    const snipMatch = b.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
    if (titleMatch) {
      const rawUrl = hrefMatch?.[1] ?? ''
      const uddg = rawUrl.match(/uddg=([^&]+)/)
      results.push({
        title: titleMatch[1].replace(/<[^>]+>/g, '').trim(),
        url: uddg ? decodeURIComponent(uddg[1]) : rawUrl,
        snippet: snipMatch?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '',
      })
    }
  }
  return results
}

async function webFetch(url: string, maxLength = 8000): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const resp = await fetch(url, { signal: controller.signal, headers: { 'Accept': 'text/html' } })
    const raw = await resp.text()
    const stripped = raw
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return stripped.slice(0, maxLength) + (stripped.length > maxLength ? '\n...(truncated)' : '')
  } finally {
    clearTimeout(timer)
  }
}

// Service Worker 保持活跃
console.log('[BAI] Background Service Worker 已启动')

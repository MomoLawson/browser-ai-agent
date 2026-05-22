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

      default:
        return { ...baseResponse, success: false, error: `未知消息类型: ${msg.type}` }
    }
  } catch (err) {
    return { ...baseResponse, success: false, error: (err as Error).message }
  }
})

// Service Worker 保持活跃
console.log('[BAI] Background Service Worker 已启动')

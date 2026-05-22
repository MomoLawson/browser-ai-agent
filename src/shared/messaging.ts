import type { AgentMessage, AgentResponse } from './types'

/**
 * 消息通信协议
 *
 * 架构设计：
 * ┌─────────────────┐    window.postMessage     ┌──────────────────┐
 * │  Content Script  │ ◄──────────────────────► │  Background/Page │
 * │  (注入的脚本)     │    chrome.runtime         │  (Service Worker │
 * └─────────────────┘    (Extension only)        │  或 Userscript) │
 *                                                └──────────────────┘
 *
 * Userscript 模式下，所有代码在同一个页面上下文中运行，
 * 不需要跨上下文通信，直接调用即可。
 * Chrome Extension 模式下，使用 chrome.runtime.sendMessage。
 */

// 消息通道名称
const CHANNEL = 'browser-ai-agent'

/**
 * 发送消息到后台（Content Script → Background）
 */
export function sendMessageToBackground(
  msg: AgentMessage,
): Promise<AgentResponse> {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      // Chrome Extension 模式
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve(response as AgentResponse)
        }
      })
    } else {
      // Userscript 模式：通过 postMessage 在页面内通信
      window.postMessage({ channel: CHANNEL, ...msg }, '*')

      const handler = (event: MessageEvent) => {
        if (event.data?.channel === CHANNEL && event.data?.id === msg.id) {
          window.removeEventListener('message', handler)
          resolve(event.data as AgentResponse)
        }
      }
      window.addEventListener('message', handler)

      // 超时保护
      setTimeout(() => {
        window.removeEventListener('message', handler)
        reject(new Error('Message timeout'))
      }, 30_000)
    }
  })
}

/**
 * 监听后台消息（Background 端使用）
 */
export function listenForMessages(
  handler: (msg: AgentMessage) => Promise<AgentResponse>,
): () => void {
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    const listener = (
      msg: AgentMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (resp: AgentResponse) => void,
    ) => {
      handler(msg).then(sendResponse)
      return true // 异步响应
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }

  // Userscript 模式
  const listener = async (event: MessageEvent) => {
    if (event.data?.channel === CHANNEL && event.data?.type) {
      const response = await handler(event.data as AgentMessage)
      window.postMessage({ channel: CHANNEL, ...response }, '*')
    }
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}

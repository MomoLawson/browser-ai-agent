import { BaseAdapter } from './base'
import type { AIPlatform, Conversation } from '../../shared/types'

export class DoubaoAdapter extends BaseAdapter {
  readonly name: AIPlatform = 'doubao'
  protected inputSelector = '[class*="input-content-container"], [class*="chat-input"]'
  protected sendButtonSelector = '[class*="send-btn-wrapper"], [class*="send-button"]'
  protected messageContainerSelector = '[class*="message-list"], [class*="conversation"]'
  protected aiMessageSelector = '[class*="assistant-message"], [class*="ai-message"]'

  injectUI(): HTMLElement | null {
    const sidebar = document.querySelector('[class*="left-side"], [class*="sidebar"]')
    if (sidebar) return this.createMountPoint(sidebar)

    const inputArea = document.querySelector(this.inputSelector)
    if (inputArea?.parentElement) return this.createMountPoint(inputArea.parentElement, 'insertBefore', inputArea)
    return null
  }

  async getConversation(): Promise<Conversation> {
    const messages: Conversation['messages'] = []
    const container = document.querySelector(this.messageContainerSelector)
    if (!container) return { platform: 'doubao', messages }

    for (const el of container.children) {
      const text = el.textContent ?? ''
      if (!text.trim()) continue
      const isUser = el.matches('[class*="user"]') || el.querySelector('[class*="user"]') !== null
      messages.push({ role: isUser ? 'user' : 'assistant', content: text, timestamp: Date.now() })
    }
    return { platform: 'doubao', messages }
  }
}

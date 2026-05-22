import { BaseAdapter } from './base'
import type { AIPlatform, Conversation } from '../../shared/types'

export class ChatGPTAdapter extends BaseAdapter {
  readonly name: AIPlatform = 'chatgpt'
  protected inputSelector = '#prompt-textarea'
  protected sendButtonSelector = 'button[data-testid="send-button"]'
  protected messageContainerSelector = 'main[role="main"]'
  protected aiMessageSelector = '[data-message-author-role="assistant"]'

  injectUI(): HTMLElement | null {
    // 注入到输入框上方
    const inputArea = document.querySelector(this.inputSelector)
    if (!inputArea?.parentElement) return null
    return this.createMountPoint(inputArea.parentElement, 'insertBefore', inputArea)
  }

  async getConversation(): Promise<Conversation> {
    const messages: Conversation['messages'] = []
    const turnElements = document.querySelectorAll('[data-testid^="conversation-turn-"]')

    turnElements.forEach((turn) => {
      const roleEl = turn.querySelector('[data-message-author-role]')
      const role = roleEl?.getAttribute('data-message-author-role') as 'user' | 'assistant' | null
      const contentEl = turn.querySelector('.whitespace-pre-wrap, .markdown, .prose')
      const content = contentEl?.textContent ?? ''
      if (role && content) messages.push({ role, content, timestamp: Date.now() })
    })

    return { platform: 'chatgpt', messages }
  }

  async sendMessage(): Promise<void> {
    const btn = document.querySelector<HTMLButtonElement>(this.sendButtonSelector)
    if (btn && !btn.disabled) { btn.click(); await new Promise((r) => setTimeout(r, 500)) }
  }
}

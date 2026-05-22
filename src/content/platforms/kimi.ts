import { BaseAdapter } from './base'
import type { AIPlatform, Conversation } from '../../shared/types'

export class KimiAdapter extends BaseAdapter {
  readonly name: AIPlatform = 'kimi'
  protected inputSelector = '.chat-input-editor, div[contenteditable="true"]'
  protected sendButtonSelector = '.send-icon, .send-button-container'
  protected messageContainerSelector = '.message-list-container, .message-list'
  protected aiMessageSelector = '.message-content, .kimi-animated-list'

  injectUI(): HTMLElement | null {
    // 优先侧边栏底部
    const sidebar = document.querySelector('.sidebar-footer, [class*="sidebar"]')
    if (sidebar) return this.createMountPoint(sidebar)

    // 后备：输入框上方
    const inputArea = document.querySelector(this.inputSelector)
    if (inputArea?.parentElement) return this.createMountPoint(inputArea.parentElement, 'insertBefore', inputArea)
    return null
  }

  async getConversation(): Promise<Conversation> {
    const messages: Conversation['messages'] = []
    const container = document.querySelector(this.messageContainerSelector)
    if (!container) return { platform: 'kimi', messages }

    for (const el of container.children) {
      const text = el.textContent ?? ''
      if (!text.trim()) continue
      const isUser = el.matches('[class*="user"]') || el.querySelector('[class*="user"]') !== null
      messages.push({ role: isUser ? 'user' : 'assistant', content: text, timestamp: Date.now() })
    }
    return { platform: 'kimi', messages }
  }

  async setInput(text: string): Promise<void> {
    const input = document.querySelector<HTMLElement>(this.inputSelector)
    if (!input) throw new Error('Kimi input not found')
    input.focus()
    document.execCommand('insertText', false, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new CompositionEvent('compositionend', { data: text }))
    await new Promise((r) => setTimeout(r, 200))
  }
}

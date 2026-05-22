import { BaseAdapter } from './base'
import type { AIPlatform, Conversation } from '../../shared/types'

export class ClaudeAdapter extends BaseAdapter {
  readonly name: AIPlatform = 'claude'
  protected inputSelector = 'div[contenteditable="true"]'
  protected sendButtonSelector = 'button[aria-label*="send"], button[aria-label*="Send"]'
  protected messageContainerSelector = 'div.font-claude-message'
  protected aiMessageSelector = '[data-testid="ai-message"]'

  injectUI(): HTMLElement | null {
    // 注入到输入框上方
    const editor = document.querySelector(this.inputSelector)
    if (!editor?.parentElement) return null
    return this.createMountPoint(editor.parentElement, 'insertBefore', editor)
  }

  async getConversation(): Promise<Conversation> {
    const messages: Conversation['messages'] = []

    const userEls = document.querySelectorAll('[data-testid="user-message"]')
    userEls.forEach((el) => {
      const content = el.textContent ?? ''
      if (content.trim()) messages.push({ role: 'user', content, timestamp: Date.now() })
    })

    const aiEls = document.querySelectorAll(this.aiMessageSelector)
    aiEls.forEach((el) => {
      const content = el.textContent ?? ''
      if (content.trim()) messages.push({ role: 'assistant', content, timestamp: Date.now() })
    })

    return { platform: 'claude', messages }
  }

  async setInput(text: string): Promise<void> {
    const input = document.querySelector<HTMLElement>(this.inputSelector)
    if (!input) throw new Error('Claude input not found')
    input.focus()
    document.execCommand('insertText', false, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 200))
  }
}

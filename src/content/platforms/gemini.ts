import { BaseAdapter } from './base'
import type { AIPlatform, Conversation } from '../../shared/types'

export class GeminiAdapter extends BaseAdapter {
  readonly name: AIPlatform = 'gemini'
  protected inputSelector = 'div[contenteditable="true"], ms-autosize-textarea'
  protected sendButtonSelector = 'button[aria-label*="send"], button[aria-label*="Send"]'
  protected messageContainerSelector = 'ms-chat-turn'
  protected aiMessageSelector = '[data-test-id="model-response"]'

  injectUI(): HTMLElement | null {
    // 注入到输入框附近
    const editor = document.querySelector(this.inputSelector)
    if (!editor?.parentElement) return null
    return this.createMountPoint(editor.parentElement, 'insertBefore', editor)
  }

  async getConversation(): Promise<Conversation> {
    const messages: Conversation['messages'] = []
    const chatTurns = document.querySelectorAll('ms-chat-turn')

    chatTurns.forEach((turn) => {
      const userMsg = turn.querySelector('[class*="user-message"], [class*="user-turn"]')
      if (userMsg?.textContent?.trim()) messages.push({ role: 'user', content: userMsg.textContent, timestamp: Date.now() })

      const aiMsg = turn.querySelector(this.aiMessageSelector)
      if (aiMsg?.textContent?.trim()) messages.push({ role: 'assistant', content: aiMsg.textContent, timestamp: Date.now() })
    })

    return { platform: 'gemini', messages }
  }
}

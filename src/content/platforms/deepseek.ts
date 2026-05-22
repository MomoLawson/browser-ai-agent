import { BaseAdapter } from './base'
import type { AIPlatform, Conversation } from '../../shared/types'
import { waitForElement } from './detector'

export class DeepSeekAdapter extends BaseAdapter {
  readonly name: AIPlatform = 'deepseek'
  protected inputSelector = '.textarea__textarea, textarea#chat-input'
  protected sendButtonSelector = '.ds-basic-button--primary'
  protected messageContainerSelector = '.ds-message'
  protected aiMessageSelector = '.ds-assistant-message-main-content'

  injectUI(): HTMLElement | null {
    const inputArea = document.querySelector(this.inputSelector)
    if (!inputArea?.parentElement) return null
    return this.createMountPoint(inputArea.parentElement, 'insertBefore', inputArea)
  }

  async getConversation(): Promise<Conversation> {
    const messages: Conversation['messages'] = []
    const messageEls = document.querySelectorAll('[data-message-author-role]')
    messageEls.forEach((el) => {
      const role = el.getAttribute('data-message-author-role') as 'user' | 'assistant' | null
      const content = el.textContent ?? ''
      if (role && content.trim()) messages.push({ role, content, timestamp: Date.now() })
    })
    return { platform: 'deepseek', messages }
  }

  async sendMessage(): Promise<void> {
    const btn = await waitForElement(this.sendButtonSelector, 5000)
    if (btn && !(btn as HTMLButtonElement).disabled) {
      ;(btn as HTMLButtonElement).click()
      await new Promise((r) => setTimeout(r, 500))
    }
  }
}

import { BaseAdapter } from './base'
import type { AIPlatform, Conversation } from '../../shared/types'

export class YuanbaoAdapter extends BaseAdapter {
  readonly name: AIPlatform = 'yuanbao'
  protected inputSelector = '.chat-input-editor, .ql-container, .yb-input-box-textarea'
  protected sendButtonSelector = '.icon-send, [class*="send-btn"]'
  protected messageContainerSelector = '.agent-dialogue__content--common__content'
  protected aiMessageSelector = '.agent-dialogue__content-split-pane'

  injectUI(): HTMLElement | null {
    const toolbar = document.querySelector('[class*="input-box"], .agent-dialogue__content--common__input-box')
    if (toolbar) return this.createMountPoint(toolbar)

    const nav = document.querySelector('.yb-common-nav__tool, .agent-dialogue__content--common__header')
    if (nav) return this.createMountPoint(nav)

    return null
  }

  async getConversation(): Promise<Conversation> {
    const messages: Conversation['messages'] = []
    const container = document.querySelector(this.messageContainerSelector)
    if (!container) return { platform: 'yuanbao', messages }

    const items = container.querySelectorAll('[class*="message"], [class*="dialogue"]')
    items.forEach((el) => {
      const text = el.textContent ?? ''
      if (!text.trim()) return
      const isUser = el.matches('[class*="user"]') || el.matches('[class*="question"]') || el.querySelector('[class*="user"]') !== null
      messages.push({ role: isUser ? 'user' : 'assistant', content: text, timestamp: Date.now() })
    })
    return { platform: 'yuanbao', messages }
  }

  async setInput(text: string): Promise<void> {
    const input = document.querySelector<HTMLElement>(this.inputSelector)
    if (!input) throw new Error('元宝 input not found')
    input.focus()

    if (input.classList.contains('ql-container')) {
      const quillEditor = input.querySelector('[contenteditable="true"]') as HTMLElement | null
      if (quillEditor) {
        quillEditor.focus()
        document.execCommand('insertText', false, text)
        quillEditor.dispatchEvent(new Event('input', { bubbles: true }))
        return
      }
    }

    document.execCommand('insertText', false, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 200))
  }
}

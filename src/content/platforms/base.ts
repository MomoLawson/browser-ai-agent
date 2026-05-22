import type { AIPlatform, Conversation } from '../../shared/types'

/**
 * 平台适配器接口
 */
export interface PlatformAdapter {
  readonly name: AIPlatform
  injectUI(): HTMLElement | null
  getConversation(): Promise<Conversation>
  setInput(text: string): Promise<void>
  sendMessage(): Promise<void>
  observe(): () => void
}

/**
 * 基础适配器 — 提供通用工具方法
 */
export abstract class BaseAdapter implements PlatformAdapter {
  abstract readonly name: AIPlatform
  protected abstract inputSelector: string
  protected abstract sendButtonSelector: string
  protected abstract messageContainerSelector: string
  protected abstract aiMessageSelector: string

  abstract injectUI(): HTMLElement | null
  abstract getConversation(): Promise<Conversation>

  /**
   * 创建一个挂载点容器（用于 AgentPanel）
   * 默认 appendChild；可指定 insertBefore 将容器插入到 reference 之前
   */
  protected createMountPoint(
    parent: Element,
    strategy: 'appendChild' | 'insertBefore' = 'appendChild',
    reference?: Element,
  ): HTMLElement {
    const container = document.createElement('div')
    container.id = 'browser-ai-agent-container'
    if (strategy === 'insertBefore' && reference) {
      parent.insertBefore(container, reference)
    } else {
      parent.appendChild(container)
    }
    return container
  }

  async setInput(text: string): Promise<void> {
    const input = document.querySelector<HTMLElement>(this.inputSelector)
    if (!input) throw new Error(`Input not found: ${this.inputSelector}`)

    if (input.isContentEditable) {
      input.focus()
      document.execCommand('insertText', false, text)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }

    if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
      input.value = text
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
  }

  async sendMessage(): Promise<void> {
    const btn = document.querySelector<HTMLElement>(this.sendButtonSelector)
    if (!btn) throw new Error(`Send button not found: ${this.sendButtonSelector}`)
    btn.click()
    await new Promise((r) => setTimeout(r, 300))
  }

  observe(): () => void {
    const observer = new MutationObserver(() => {
      if (!document.getElementById('browser-ai-agent-container')) {
        this.injectUI()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }
}

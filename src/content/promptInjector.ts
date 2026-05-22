/**
 * PromptInjector — 对话注入系统提示词
 *
 * 不碰输入框。等用户发送消息后，在对话 DOM 中修改消息内容，
 * 将提示词注入到用户消息前面，AI 读到的就是"提示词 + 用户消息"。
 *
 * 在所有平台上通用，不受输入框实现方式（ProseMirror/textarea/原生）影响。
 */
const PROMPT_PREFIX = '[local-project:'

function buildPrompt(name: string): string {
  return (
    `[本地文件系统已连接: ${name}]\n` +
    '如需操作文件，请在回复中使用：\n' +
    '• [list] 列出项目文件\n' +
    '• [read: 文件路径] 读取文件\n' +
    '• [write: 文件路径]\n' +
    '  文件内容\n' +
    '  [/write] 写入文件\n' +
    '---\n'
  )
}

// ============================================================
// 持久化
// ============================================================

const LS_KEY = 'bai_project'

export function saveProjectName(name: string): void {
  try { localStorage.setItem(LS_KEY, name) } catch {}
}
export function getSavedProjectName(): string | null {
  try { return localStorage.getItem(LS_KEY) } catch { return null }
}
export function clearSavedProject(): void {
  try { localStorage.removeItem(LS_KEY) } catch {}
}

// ============================================================
// PromptInjector 类
// ============================================================

export class PromptInjector {
  private injected = false
  private promptText = ''
  private observer: MutationObserver | null = null
  private checkTimer: ReturnType<typeof setInterval> | null = null

  /** 武装：下次用户发送消息时，自动将提示词注入对话 */
  arm(name: string): void {
    this.injected = false
    this.promptText = buildPrompt(name)
  }

  /** 开始监听对话变化 */
  start(): void {
    // 1. MutationObserver 监控 DOM 变化
    this.observer = new MutationObserver(() => this.checkNewMessage())
    this.observer.observe(document.body, { childList: true, subtree: true })

    // 2. 定时轮询作为后备
    this.checkTimer = setInterval(() => this.checkNewMessage(), 1000)
  }

  /** 停止监听 */
  stop(): void {
    this.observer?.disconnect()
    if (this.checkTimer) clearInterval(this.checkTimer)
    this.observer = null
    this.checkTimer = null
  }

  /** 是否已注入 */
  get isInjected(): boolean { return this.injected }

  // ============================================================
  // 核心：检测新用户消息 + 注入提示词
  // ============================================================

  private checkNewMessage(): void {
    if (this.injected) return

    const msgEl = this.findLatestUserMessage()
    if (!msgEl) return

    const text = msgEl.textContent || ''
    // 检查是否已包含提示词（避免重复）
    if (text.includes(PROMPT_PREFIX)) {
      this.injected = true
      return
    }

    // 检查消息是否真的有内容（不是空的欢迎消息等）
    if (text.trim().length < 3) return

    // 注入提示词！
    this.injectIntoMessage(msgEl)
    this.injected = true
    console.log('[BAI] ✅ 提示词已注入到对话')
  }

  /**
   * 查找最新的用户消息 DOM 元素
   * 兼容所有平台：
   * - ChatGPT/DeepSeek: [data-message-author-role="user"]
   * - Claude: [data-testid="user-message"]
   * - Gemini: ms-chat-turn 内的用户消息
   */
  private findLatestUserMessage(): Element | null {
    // 方法 1: data-message-author-role
    const all = document.querySelectorAll('[data-message-author-role="user"]')
    if (all.length > 0) return all[all.length - 1]

    // 方法 2: data-testid (Claude)
    const claudeMsgs = document.querySelectorAll('[data-testid="user-message"]')
    if (claudeMsgs.length > 0) return claudeMsgs[claudeMsgs.length - 1]

    // 方法 3: Gemini chat turns
    const turns = document.querySelectorAll('ms-chat-turn')
    if (turns.length > 0) {
      for (let i = turns.length - 1; i >= 0; i--) {
        const userEl = turns[i].querySelector('[class*="user-message"], [class*="user-turn"]')
        if (userEl && (userEl.textContent || '').trim().length > 3) return userEl
      }
    }

    return null
  }

  /**
   * 将提示词注入到用户消息元素中
   * 在消息内容前面插入提示词
   */
  private injectIntoMessage(msgEl: Element): void {
    try {
      // 方法 1: 如果消息内容在子元素中（最常见）
      const contentEl =
        msgEl.querySelector('[class*="content"], [class*="message"], .whitespace-pre-wrap, .markdown, .prose') ||
        msgEl.querySelector('p, div, span')

      if (contentEl && contentEl.textContent) {
        contentEl.textContent = this.promptText + '\n' + contentEl.textContent
        return
      }

      // 方法 2: 直接修改消息元素本身
      if (msgEl.textContent) {
        msgEl.textContent = this.promptText + '\n' + msgEl.textContent
        return
      }
    } catch {
      // 静默失败，不要破坏页面
    }
  }
}

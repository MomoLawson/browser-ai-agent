/**
 * injectUtils — 多策略输入框填充
 *
 * 不同 AI 平台使用不同的输入机制：
 * - ChatGPT: ProseMirror (contenteditable div) → execCommand('insertText')
 * - DeepSeek: React 受控 textarea → 原生 setter + input 事件
 * - 通用后备：直接 value 赋值
 */
const INPUT_SELECTORS = [
  '#prompt-textarea',
  'div[contenteditable="true"]',
  'textarea#chat-input',
  '.chat-input-editor',
  '.textarea__textarea',
  '[class*="input-content-container"]',
  '.ql-container [contenteditable]',
  '.ds-input__input',
  'textarea',
]

// ============================================================
// 查找输入框
// ============================================================

export function findInput(): HTMLElement | null {
  for (const sel of INPUT_SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel)
    if (el) return el
  }
  return null
}

// ============================================================
// 多策略填充
// ============================================================

export function fillInput(text: string): boolean {
  for (const sel of INPUT_SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel)
    if (!el) continue

    // 策略 1: contenteditable (ChatGPT 的 ProseMirror)
    if (el.isContentEditable) {
      el.focus()
      document.execCommand('selectAll', false)
      document.execCommand('insertText', false, text)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }

    // 策略 2: React 受控 textarea (DeepSeek)
    if (el instanceof HTMLTextAreaElement) {
      const nativeSetter = getNativeSetter(el)
      if (nativeSetter) {
        nativeSetter.call(el, text)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      }
      // 后备
      el.value = text
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }

    // 策略 3: 普通 input
    if (el instanceof HTMLInputElement) {
      el.value = text
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }
  }

  return false
}

/**
 * 获取 textarea 的原生 value setter
 * 用于绕过 React 的受控组件机制
 */
function getNativeSetter(el: HTMLTextAreaElement): Function | null {
  // 方法 1: 通过 __reactFiber 查找
  try {
    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$'))
    if (fiberKey) {
      const fiber = (el as any)[fiberKey]
      // 遍历 fiber 树查找 stateNode
      let node = fiber
      while (node) {
        if (node.stateNode && typeof node.stateNode === 'object') {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype, 'value'
          )?.set
          if (setter) return setter
        }
        node = node.return || node.child
      }
    }
  } catch {}

  // 方法 2: 直接从原型获取
  return Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype, 'value'
  )?.set || null
}

// ============================================================
// 点击发送按钮
// ============================================================

/**
 * 模拟 Enter 键发送（比点击按钮更可靠）
 * 大多数 AI 网站 Enter = 发送，Shift+Enter = 换行
 */
export function simulateSend(): boolean {
  // 方案 1: 在输入框上触发 Enter 键
  const input = findInput()
  if (input) {
    input.focus()
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
      bubbles: true, cancelable: true, composed: true,
    }))
    return true
  }
  // 方案 2: 点击发送按钮
  return clickSendButton()
}

export function clickSendButton(): boolean {
  const sels = [
    'button[data-testid="send-button"]',
    '.ds-basic-button--primary',
    'button[aria-label*="send"]', 'button[aria-label*="Send"]',
    '.send-icon', '.send-button-container',
    '[class*="send-btn-wrapper"]', '[class*="send-btn"]',
    '.icon-send',
    'button[type="submit"]',
  ]
  for (const sel of sels) {
    const btn = document.querySelector<HTMLButtonElement>(sel)
    if (!btn || btn.disabled) continue
    btn.click()
    return true
  }
  return false
}

// ============================================================
// 仅追加文本（不替换全部内容）
// ============================================================

export function appendToInput(text: string): boolean {
  for (const sel of INPUT_SELECTORS) {
    const el = document.querySelector<HTMLElement>(sel)
    if (!el) continue

    if (el.isContentEditable) {
      el.focus()
      // 移到末尾
      const s = window.getSelection()
      const r = document.createRange()
      r.selectNodeContents(el)
      r.collapse(false)
      s?.removeAllRanges()
      s?.addRange(r)

      document.execCommand('insertText', false, '\n\n' + text)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    }

    if (el instanceof HTMLTextAreaElement) {
      const nativeSetter = getNativeSetter(el)
      const newVal = el.value + '\n\n' + text
      if (nativeSetter) {
        nativeSetter.call(el, newVal)
      } else {
        el.value = newVal
      }
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }
  }

  return false
}

import type { AIPlatform } from '../../shared/types'
import { PLATFORM_DOMAINS } from '../../shared/constants'

/**
 * 平台检测引擎
 *
 * 根据当前页面 URL 检测正在访问哪个 AI 平台。
 * 在内容脚本启动时立即调用。
 */
export function detectPlatform(): AIPlatform | null {
  const host = window.location.hostname
  for (const [domain, platform] of Object.entries(PLATFORM_DOMAINS)) {
    if (host === domain || host.endsWith('.' + domain)) {
      return platform
    }
  }
  return null
}

/**
 * 获取平台显示名称
 */
export function getPlatformDisplayName(platform: AIPlatform): string {
  const names: Record<AIPlatform, string> = {
    chatgpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
    deepseek: 'DeepSeek',
    kimi: 'Kimi',
    doubao: '豆包',
    yuanbao: '元宝',
  }
  return names[platform]
}

/**
 * 等待 DOM 中出现指定选择器的元素（带超时）
 */
export function waitForElement(
  selector: string,
  timeout = 10_000,
  root: Document | ShadowRoot | Element = document,
): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = root.querySelector(selector)
    if (existing) {
      resolve(existing)
      return
    }

    const observer = new MutationObserver(() => {
      const el = root.querySelector(selector)
      if (el) {
        observer.disconnect()
        resolve(el)
      }
    })

    observer.observe(root === document ? document.body : root, {
      childList: true,
      subtree: true,
    })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

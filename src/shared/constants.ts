import type { AIPlatform } from './types'

/** 项目元信息 */
export const PROJECT_NAME = 'Browser AI Agent'
export const VERSION = '0.1.0'

/** 所有支持的 AI 平台域名映射 */
export const PLATFORM_DOMAINS: Record<string, AIPlatform> = {
  'chatgpt.com': 'chatgpt',
  'chat.openai.com': 'chatgpt',
  'claude.ai': 'claude',
  'gemini.google.com': 'gemini',
  'chat.deepseek.com': 'deepseek',
  'kimi.moonshot.cn': 'kimi',
  'www.doubao.com': 'doubao',
  'doubao.com': 'doubao',
  'yuanbao.tencent.com': 'yuanbao',
}

/** 注入 UI 的容器 ID */
export const UI_CONTAINER_ID = 'browser-ai-agent-container'

/** GM 存储 Key */
export const GM_STORAGE_KEYS = {
  PROJECT_HANDLE: 'bai_project_handle',
  PROJECT_PATH: 'bai_project_path',
  SETTINGS: 'bai_settings',
} as const

/** 默认设置 */
export const DEFAULT_SETTINGS = {
  agentMode: 'plan' as const,
  autoConfirmRead: true,
  autoConfirmWrite: false,
} as const

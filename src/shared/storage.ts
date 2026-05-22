import { GM_STORAGE_KEYS } from './constants'
import type { AgentMode } from './types'

/**
 * 跨平台存储抽象层
 *
 * - Chrome Extension: 使用 chrome.storage.local
 * - Userscript: 使用 GM_setValue / GM_getValue
 */

function isChromeExtension(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id
}

// ============================================================
// 通用 KV 存储
// ============================================================

export async function getValue<T>(key: string): Promise<T | undefined> {
  if (isChromeExtension()) {
    const result = await chrome.storage.local.get(key)
    return result[key] as T | undefined
  }
  // Userscript — GM_getValue 是同步的
  return GM_getValue<T>(key)
}

export async function setValue<T>(key: string, value: T): Promise<void> {
  if (isChromeExtension()) {
    await chrome.storage.local.set({ [key]: value })
  } else {
    GM_setValue(key, value)
  }
}

export async function removeValue(key: string): Promise<void> {
  if (isChromeExtension()) {
    await chrome.storage.local.remove(key)
  } else {
    GM_deleteValue(key)
  }
}

// ============================================================
// 项目级别的持久化
// ============================================================

export interface ProjectSettings {
  projectPath: string
  agentMode: AgentMode
}

export async function getProjectSettings(): Promise<ProjectSettings | null> {
  return (await getValue<ProjectSettings>(GM_STORAGE_KEYS.SETTINGS)) ?? null
}

export async function saveProjectSettings(settings: ProjectSettings): Promise<void> {
  await setValue(GM_STORAGE_KEYS.SETTINGS, settings)
}

/**
 * 存储 DirectoryHandle（Userscript 中持久化 name，Chrome Extension 中存序列化数据）
 * 注意：FileSystemDirectoryHandle 本身不能直接序列化，
 * 在 Extension 中可通过 chrome.fileSystem 或 IndexedDB 持久化
 */
export async function saveDirectoryHandleInfo(
  name: string,
): Promise<void> {
  await setValue(GM_STORAGE_KEYS.PROJECT_HANDLE, { name })
}

export async function getDirectoryHandleInfo(): Promise<{ name: string } | null> {
  return (await getValue<{ name: string }>(GM_STORAGE_KEYS.PROJECT_HANDLE)) ?? null
}

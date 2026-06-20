import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 应用设置
 */
export interface AppSettings {
  browser: 'chrome' | 'edge'
  language: 'auto' | 'zh-CN' | 'en-US'
}

const defaults: AppSettings = {
  browser: 'chrome',
  language: 'auto',
}

let _settings: AppSettings | null = null
let _filePath: string | null = null

function getFilePath(): string {
  if (!_filePath) {
    _filePath = path.join(app.getPath('userData'), 'settings.json')
  }
  return _filePath
}

export function loadSettings(): AppSettings {
  if (_settings) return _settings
  try {
    const raw = fs.readFileSync(getFilePath(), 'utf-8')
    _settings = { ...defaults, ...JSON.parse(raw) }
  } catch {
    _settings = { ...defaults }
  }
  return _settings!
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const current = loadSettings()
  _settings = { ...current, ...patch }
  try {
    fs.writeFileSync(getFilePath(), JSON.stringify(_settings, null, 2), 'utf-8')
  } catch (err: any) {
    console.error('[Settings] Failed to save:', err.message)
  }
  return _settings
}

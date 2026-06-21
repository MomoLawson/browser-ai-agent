import { ipcMain, BrowserWindow, app } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { registry } from './services/registry'
import { loadSettings, saveSettings, type AppSettings } from './settings'

// macOS 浏览器二进制路径
const BROWSER_PATHS: Record<string, string> = {
  chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  edge: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
}

/**
 * 注册所有 IPC 通道
 *
 * 渲染进程通过 preload 暴露的 API 调用这些通道。
 */
export function registerIPC(mainWindow: BrowserWindow): void {
  // 获取所有服务状态
  ipcMain.handle('bai:get-services', () => {
    return registry.getStatuses()
  })

  // 切换服务开关
  ipcMain.handle('bai:toggle-service', async (_event, name: string) => {
    try {
      const enabled = await registry.toggle(name)
      return { success: true, enabled }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 获取 server 状态
  ipcMain.handle('bai:get-server-info', () => {
    return {
      url: 'http://127.0.0.1:3939',
      running: true,
    }
  })

  // ── Settings ─────────────────────────────────────────────

  ipcMain.handle('bai:get-settings', () => {
    return loadSettings()
  })

  ipcMain.handle('bai:save-settings', (_event, patch: Partial<AppSettings>) => {
    return saveSettings(patch)
  })

  // ── Install Extension ────────────────────────────────────

  ipcMain.handle('bai:install-extension', (_event, browser: string) => {
    const extPath = path.resolve(app.getAppPath(), '..', 'dist-extension')
    const binPath = BROWSER_PATHS[browser] || BROWSER_PATHS.chrome

    // 检查浏览器是否存在
    if (!fs.existsSync(binPath)) {
      return { success: false, error: `Browser not found: ${binPath}` }
    }

    // 直接启动浏览器并加载扩展（无需用户手动操作）
    const child = spawn(binPath, [
      `--load-extension=${extPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--silent-debugger-extension-api',
    ], {
      detached: true,
      stdio: 'ignore',
    })
    child.unref()

    return { success: true, extPath }
  })
}

/**
 * 向渲染进程发送日志
 */
let _mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow): void {
  _mainWindow = win
}

export function sendLog(message: string): void {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send('bai:log', message)
  }
}

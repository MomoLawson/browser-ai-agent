import { ipcMain, BrowserWindow, app } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { registry } from './services/registry'
import { loadSettings, saveSettings, type AppSettings } from './settings'
import { isConnected } from './server'

// macOS 浏览器二进制路径
const BROWSER_PATHS: Record<string, string> = {
  chrome: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  edge: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
}

/**
 * 注册所有 IPC 通道
 */
export function registerIPC(mainWindow: BrowserWindow): void {
  ipcMain.handle('bai:get-services', () => registry.getStatuses())

  ipcMain.handle('bai:toggle-service', async (_event, name: string) => {
    try {
      const enabled = await registry.toggle(name)
      return { success: true, enabled }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('bai:get-server-info', () => ({
    url: 'http://127.0.0.1:3939',
    running: true,
    connected: isConnected(),
  }))

  // ── Settings ─────────────────────────────────────────────

  ipcMain.handle('bai:get-settings', () => loadSettings())

  ipcMain.handle('bai:save-settings', (_event, patch: Partial<AppSettings>) => saveSettings(patch))

  // ── Master switch ────────────────────────────────────────

  ipcMain.handle('bai:toggle-master', () => {
    const s = loadSettings()
    const newVal = !s.masterSwitch
    saveSettings({ masterSwitch: newVal })
    return { masterSwitch: newVal }
  })

  // ── State (connection + master) ──────────────────────────

  ipcMain.handle('bai:get-state', () => ({
    masterSwitch: loadSettings().masterSwitch,
    connected: isConnected(),
  }))

  // ── Install Extension ────────────────────────────────────

  ipcMain.handle('bai:install-extension', (_event, browser: string) => {
    const extPath = path.resolve(app.getAppPath(), '..', 'dist-extension')
    const binPath = BROWSER_PATHS[browser] || BROWSER_PATHS.chrome

    if (!fs.existsSync(binPath)) {
      return { success: false, error: `Browser not found: ${binPath}` }
    }

    const child = spawn(binPath, [
      `--load-extension=${extPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--silent-debugger-extension-api',
    ], { detached: true, stdio: 'ignore' })
    child.unref()

    return { success: true, extPath }
  })

  // ── Quit ─────────────────────────────────────────────────

  ipcMain.handle('bai:quit', () => {
    app.quit()
  })
}

// ── 向渲染进程发送事件 ────────────────────────────────────

let _mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow): void {
  _mainWindow = win
}

export function sendLog(message: string): void {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send('bai:log', message)
  }
}

export function sendEvent(event: string, data: any): void {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send(event, data)
  }
}

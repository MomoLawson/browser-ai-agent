import { ipcMain, BrowserWindow, app } from 'electron'
import { exec } from 'node:child_process'
import path from 'node:path'
import { registry } from './services/registry'
import { loadSettings, saveSettings, type AppSettings } from './settings'

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
    // dist-extension 相对于 electron-app/ 的上级目录
    const extPath = path.resolve(app.getAppPath(), '..', 'dist-extension')
    const extUrl = `chrome://extensions/`

    if (browser === 'edge') {
      // macOS: open Edge with --load-extension
      exec(`open -a "Microsoft Edge" --args --load-extension="${extPath}" "${extUrl}"`, (err) => {
        if (err) {
          // fallback: 只打开扩展页面
          exec(`open -a "Microsoft Edge" "${extUrl}"`)
        }
      })
    } else {
      // macOS: open Chrome with --load-extension
      exec(`open -a "Google Chrome" --args --load-extension="${extPath}" "${extUrl}"`, (err) => {
        if (err) {
          exec(`open -a "Google Chrome" "${extUrl}"`)
        }
      })
    }

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

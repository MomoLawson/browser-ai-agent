import { contextBridge, ipcRenderer } from 'electron'

/**
 * Preload 脚本 — 安全地暴露 API 给渲染进程
 *
 * 通过 contextBridge 暴露，渲染进程只能访问这里定义的方法，
 * 无法直接访问 Node.js 或 Electron 内部 API。
 */
contextBridge.exposeInMainWorld('bai', {
  /** 获取所有服务状态 */
  getServices: (): Promise<Array<{
    id: string
    name: string
    enabled: boolean
    running: boolean
    info?: string
    error?: string
  }>> => ipcRenderer.invoke('bai:get-services'),

  /** 切换服务开关 */
  toggleService: (name: string): Promise<{ success: boolean; enabled?: boolean; error?: string }> =>
    ipcRenderer.invoke('bai:toggle-service', name),

  /** 获取 server 信息 */
  getServerInfo: (): Promise<{ url: string; running: boolean; connected: boolean }> =>
    ipcRenderer.invoke('bai:get-server-info'),

  /** 获取设置 */
  getSettings: (): Promise<{ browser: string; language: string; masterSwitch: boolean }> =>
    ipcRenderer.invoke('bai:get-settings'),

  /** 保存设置 */
  saveSettings: (patch: { browser?: string; language?: string; masterSwitch?: boolean }): Promise<any> =>
    ipcRenderer.invoke('bai:save-settings', patch),

  /** 切换总开关 */
  toggleMaster: (): Promise<{ masterSwitch: boolean }> =>
    ipcRenderer.invoke('bai:toggle-master'),

  /** 获取完整状态 */
  getState: (): Promise<{ masterSwitch: boolean; connected: boolean }> =>
    ipcRenderer.invoke('bai:get-state'),

  /** 安装扩展：打开选中的浏览器并加载扩展 */
  installExtension: (browser: string): Promise<{ success: boolean; extPath: string }> =>
    ipcRenderer.invoke('bai:install-extension', browser),

  /** 退出应用 */
  quit: (): Promise<void> =>
    ipcRenderer.invoke('bai:quit'),

  /** 监听扩展连接状态变化 */
  onExtConnected: (callback: (connected: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, connected: boolean) => callback(connected)
    ipcRenderer.on('bai:ext-connected', handler)
    return () => ipcRenderer.removeListener('bai:ext-connected', handler)
  },

  /** 监听日志 */
  onLog: (callback: (message: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: string) => callback(message)
    ipcRenderer.on('bai:log', handler)
    return () => ipcRenderer.removeListener('bai:log', handler)
  },
})

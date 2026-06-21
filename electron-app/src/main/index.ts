import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { startServer, stopServer, setNotifyRenderer } from './server'
import { registry } from './services/registry'
import { ShellService } from './services/shell'
import { registerIPC, setMainWindow, sendLog, sendEvent } from './ipc'

// 禁用 GPU 硬件加速，避免 EGL Driver 报错
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 420,
    height: 520,
    resizable: true,
    title: 'BAI Desktop',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 加载 renderer HTML
  const htmlPath = path.join(__dirname, '../renderer/index.html')
  win.loadFile(htmlPath)

  return win
}

async function bootstrap(): Promise<void> {
  await app.whenReady()

  // 1. 注册服务
  const shellService = new ShellService()
  shellService.onLog((msg) => sendLog(msg))
  registry.register(shellService)

  // 2. 启动 HTTP server
  try {
    await startServer()
    // 连接事件转发到渲染进程
    setNotifyRenderer((event, data) => sendEvent(event, data))
    console.log('[Main] HTTP server started')
  } catch (err: any) {
    console.error('[Main] HTTP server failed:', err.message)
  }

  // 3. 启动所有 enabled 的服务
  await registry.startAll()

  // 4. 创建窗口
  mainWindow = createWindow()
  setMainWindow(mainWindow)
  registerIPC(mainWindow)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// macOS: 关闭所有窗口后不退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && mainWindow === null) {
    mainWindow = createWindow()
    setMainWindow(mainWindow)
  }
})

// 退出前清理
app.on('before-quit', async () => {
  await registry.stopAll()
  await stopServer()
})

bootstrap().catch(err => {
  console.error('[Main] Bootstrap failed:', err)
  app.quit()
})

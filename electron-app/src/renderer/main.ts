/**
 * BAI Desktop — 渲染进程
 *
 * 显示服务状态和开关，接收日志，管理设置。
 */

// ── i18n ─────────────────────────────────────────────────

type Lang = 'auto' | 'zh-CN' | 'en-US'

const I18N: Record<string, Record<string, string>> = {
  'zh-CN': {
    settings: '设置',
    services: '服务',
    logs: '日志',
    clear: '清除',
    browser: '浏览器',
    language: '语言',
    running: '运行中',
    stopped: '已停止',
    no_services: '暂无服务',
    waiting: '等待活动...',
    master_switch: '总开关',
    connected: '已连接',
    disconnected: '未连接',
    install_ext: '安装扩展',
    install_script: '安装脚本',
    install_hint: '将自动打开浏览器并加载扩展',
    install_ok: '浏览器已打开，请在扩展页面确认加载',
    install_fail: '打开浏览器失败',
    script_hint: '用户脚本安装功能开发中',
    quit: '退出 BAI Desktop',
  },
  'en-US': {
    settings: 'Settings',
    services: 'Services',
    logs: 'Logs',
    clear: 'Clear',
    browser: 'Browser',
    language: 'Language',
    running: 'Running',
    stopped: 'Stopped',
    no_services: 'No services registered',
    waiting: 'Waiting for activity...',
    master_switch: 'Master Switch',
    connected: 'Connected',
    disconnected: 'Disconnected',
    install_ext: 'Install Extension',
    install_script: 'Install Script',
    install_hint: 'Opens browser and loads the extension automatically',
    install_ok: 'Browser opened — confirm the extension in the extensions page',
    install_fail: 'Failed to open browser',
    script_hint: 'Userscript install coming soon',
    quit: 'Quit BAI Desktop',
  },
}

let currentLang: Lang = 'auto'

function resolveLang(lang: Lang): string {
  if (lang !== 'auto') return lang
  const nav = navigator.language || ''
  if (nav.startsWith('zh')) return 'zh-CN'
  return 'en-US'
}

function t(key: string): string {
  const lang = resolveLang(currentLang)
  return I18N[lang]?.[key] || I18N['en-US']?.[key] || key
}

function applyI18n(): void {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n')!
    el.textContent = t(key)
  })
}

interface ServiceStatus {
  id: string
  name: string
  enabled: boolean
  running: boolean
  info?: string
  error?: string
}

declare const bai: {
  getServices(): Promise<ServiceStatus[]>
  toggleService(name: string): Promise<{ success: boolean; enabled?: boolean; error?: string }>
  getServerInfo(): Promise<{ url: string; running: boolean; connected: boolean }>
  getSettings(): Promise<{ browser: string; language: string; masterSwitch: boolean }>
  saveSettings(patch: { browser?: string; language?: string; masterSwitch?: boolean }): Promise<any>
  toggleMaster(): Promise<{ masterSwitch: boolean }>
  getState(): Promise<{ masterSwitch: boolean; connected: boolean }>
  installExtension(browser: string): Promise<{ success: boolean; extPath: string }>
  quit(): Promise<void>
  onExtConnected(callback: (connected: boolean) => void): () => void
  onLog(callback: (message: string) => void): () => void
}

// ── Service icons ────────────────────────────────────────

const ICONS: Record<string, string> = {
  shell: '⚡',
  lsp: '🔍',
  git: '📦',
}

// ── DOM refs ─────────────────────────────────────────────

const servicesList = document.getElementById('services-list')!
const logArea = document.getElementById('log-area')!
const btnClear = document.getElementById('btn-clear')!
const serverUrl = document.getElementById('server-url')!
const connDot = document.getElementById('conn-dot')!
const connText = document.getElementById('conn-text')!
const settingBrowser = document.getElementById('setting-browser') as HTMLSelectElement
const settingLanguage = document.getElementById('setting-language') as HTMLSelectElement
const btnSettings = document.getElementById('btn-settings')!
const btnInstall = document.getElementById('btn-install')!
const btnInstallScript = document.getElementById('btn-install-userscript')!
const installHint = document.getElementById('install-hint')!
const masterToggle = document.getElementById('master-toggle') as HTMLInputElement
const masterBar = document.querySelector('.master-bar')!
const btnQuit = document.getElementById('btn-quit')!
const viewMain = document.getElementById('view-main')!
const viewSettings = document.getElementById('view-settings')!

// ── View toggle ──────────────────────────────────────────

let showingSettings = false

function toggleSettings(): void {
  showingSettings = !showingSettings
  viewMain.style.display = showingSettings ? 'none' : 'flex'
  viewSettings.style.display = showingSettings ? 'flex' : 'none'
  btnSettings.classList.toggle('active', showingSettings)
}

btnSettings.addEventListener('click', toggleSettings)

// ── Install extension ────────────────────────────────────

btnInstall.addEventListener('click', async () => {
  const browser = settingBrowser.value
  installHint.textContent = ''
  installHint.className = 'install-hint'
  try {
    const result = await bai.installExtension(browser)
    if (result.success) {
      installHint.textContent = t('install_ok')
      installHint.className = 'install-hint success'
    }
  } catch {
    installHint.textContent = t('install_fail')
    installHint.className = 'install-hint error'
  }
})

// ── Install userscript (placeholder) ─────────────────────

btnInstallScript.addEventListener('click', () => {
  installHint.textContent = t('script_hint')
  installHint.className = 'install-hint'
})

// ── Master switch ────────────────────────────────────────

masterToggle.addEventListener('change', async () => {
  const result = await bai.toggleMaster()
  masterBar.classList.toggle('off', !result.masterSwitch)
})

// ── Connection status ────────────────────────────────────

function updateConnection(connected: boolean): void {
  connDot.className = connected ? 'dot dot-green' : 'dot dot-gray'
  connText.textContent = t(connected ? 'connected' : 'disconnected')
}

// 初始状态
bai.getState().then(s => {
  masterToggle.checked = s.masterSwitch
  masterBar.classList.toggle('off', !s.masterSwitch)
  updateConnection(s.connected)
})

// 监听扩展连接事件
bai.onExtConnected((connected) => {
  updateConnection(connected)
})

// 定期刷新连接状态
setInterval(async () => {
  const s = await bai.getState()
  updateConnection(s.connected)
}, 5000)

// ── Quit ─────────────────────────────────────────────────

btnQuit.addEventListener('click', async () => {
  await bai.quit()
})

// ── Render services ──────────────────────────────────────

let services: ServiceStatus[] = []

async function loadServices(): Promise<void> {
  services = await bai.getServices()
  renderServices()
}

function renderServices(): void {
  if (services.length === 0) {
    servicesList.innerHTML = `<div style="padding:12px;color:#555;text-align:center">${t('no_services')}</div>`
    return
  }

  servicesList.innerHTML = services.map(s => `
    <div class="service-item">
      <div class="service-left">
        <div class="service-icon">${ICONS[s.id] || '⚙️'}</div>
        <div>
          <div class="service-name">${esc(s.name)}</div>
          <div class="service-info">${s.running ? (s.info || t('running')) : t('stopped')}</div>
        </div>
      </div>
      <label class="toggle">
        <input type="checkbox" ${s.enabled ? 'checked' : ''} data-service="${esc(s.id)}">
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join('')

  // 绑定 toggle 事件
  servicesList.querySelectorAll('input[type="checkbox"]').forEach(el => {
    el.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement
      const name = target.dataset.service!
      target.disabled = true
      const result = await bai.toggleService(name)
      if (result.success) {
        await loadServices()
      } else {
        // 恢复开关状态
        target.checked = !target.checked
        appendLog(`[Error] Failed to toggle ${name}: ${result.error}`)
      }
      target.disabled = false
    })
  })
}

// ── Logs ─────────────────────────────────────────────────

let logCount = 0

function appendLog(message: string): void {
  // 移除空状态
  if (logCount === 0) {
    const empty = logArea.querySelector('.log-empty')
    if (empty) empty.remove()
  }

  logCount++
  const line = document.createElement('div')
  line.className = 'log-line'
  if (message.includes('[Shell]')) line.classList.add('shell')
  line.textContent = message
  logArea.appendChild(line)

  // 保持最多 200 条
  while (logArea.children.length > 200) {
    logArea.removeChild(logArea.firstChild!)
  }

  // 自动滚动
  logArea.scrollTop = logArea.scrollHeight
}

// ── Init ─────────────────────────────────────────────────

async function init(): Promise<void> {
  // Server info
  const info = await bai.getServerInfo()
  serverUrl.textContent = info.url
  updateConnection(info.connected)

  // Settings
  const settings = await bai.getSettings()
  settingBrowser.value = settings.browser
  settingLanguage.value = settings.language
  currentLang = settings.language as Lang
  applyI18n()

  settingBrowser.addEventListener('change', async () => {
    await bai.saveSettings({ browser: settingBrowser.value })
  })

  settingLanguage.addEventListener('change', async () => {
    currentLang = settingLanguage.value as Lang
    await bai.saveSettings({ language: settingLanguage.value })
    applyI18n()
    renderServices()
    // 更新安装提示文字（如果未显示结果）
    if (!installHint.classList.contains('success') && !installHint.classList.contains('error')) {
      installHint.textContent = t('install_hint')
    }
  })

  // Services
  await loadServices()

  // 监听日志
  bai.onLog((msg: string) => {
    appendLog(msg)
    // 服务状态可能变了，刷新
    loadServices()
  })

  // 清除按钮
  btnClear.addEventListener('click', () => {
    logArea.innerHTML = `<div class="log-empty">${t('waiting')}</div>`
    logCount = 0
  })
}

function esc(s: string): string {
  const div = document.createElement('div')
  div.textContent = s
  return div.innerHTML
}

init()

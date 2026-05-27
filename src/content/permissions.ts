/**
 * Permissions — 敏感文件访问确认
 *
 * 当 AI 读取或修改 .env 等敏感文件时，弹出确认窗口。
 * 用户选择"总是允许/拒绝"后存入 localStorage，不再弹出。
 */

const STORAGE_KEY = 'bai_perms'
const SENSITIVE_PATTERNS = [
  /^\.env/,
  /\.env\./,
  /^\.gitignore$/,
  /^\.npmrc$/,
  /^\.yarnrc/,
  /\.pem$/,
  /\.key$/,
  /^id_rsa/,
  /^id_ed25519/,
  /credentials?\.json$/i,
  /secrets?\.json$/i,
  /secrets?\.ya?ml$/i,
  /\.secret/i,
  /password/i,
  /token/i,
  /\.keystore$/i,
  /docker-compose\.ya?ml$/i,
  /\.htpasswd$/i,
]

export type PermDecision = 'allow' | 'deny'

interface PermStore {
  [filePath: string]: PermDecision
}

function load(): PermStore {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function save(store: PermStore): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)) } catch {}
}

function getFileName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || filePath
}

export function isSensitiveFile(filePath: string): boolean {
  const name = getFileName(filePath)
  return SENSITIVE_PATTERNS.some(p => p.test(name) || p.test(filePath))
}

export function getSavedDecision(filePath: string): PermDecision | null {
  const store = load()
  const name = getFileName(filePath)
  // 精确路径匹配或文件名匹配
  return store[filePath] ?? store[name] ?? null
}

function saveDecision(filePath: string, decision: PermDecision): void {
  const store = load()
  const name = getFileName(filePath)
  store[filePath] = decision
  store[name] = decision
  save(store)
}

// ============================================================
// 确认对话框
// ============================================================

let _dialogEl: HTMLDivElement | null = null

function injectPermCSS(): void {
  if (document.getElementById('bai-perm-style')) return
  const style = document.createElement('style')
  style.id = 'bai-perm-style'
  style.textContent = `
.bai-perm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483646;display:flex;align-items:center;justify-content:center;animation:bai-perm-fadein .15s ease}
.bai-perm-box{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:24px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.5);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e2e8f0}
.bai-perm-title{font-size:15px;font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.bai-perm-desc{font-size:13px;color:#94a3b8;margin-bottom:16px;line-height:1.5}
.bai-perm-file{font-family:'SF Mono','Fira Code',monospace;font-size:12px;background:#0f172a;padding:6px 10px;border-radius:6px;margin-bottom:16px;color:#f59e0b;word-break:break-all}
.bai-perm-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bai-perm-btn{padding:10px 14px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.bai-perm-btn:active{transform:scale(.97)}
.bai-perm-btn.once{background:#334155;color:#e2e8f0}
.bai-perm-btn.once:hover{background:#475569}
.bai-perm-btn.deny{background:#334155;color:#f87171}
.bai-perm-btn.deny:hover{background:#475569}
.bai-perm-btn.always-allow{background:#059669;color:#fff}
.bai-perm-btn.always-allow:hover{background:#047857}
.bai-perm-btn.always-deny{background:#dc2626;color:#fff}
.bai-perm-btn.always-deny:hover{background:#b91c1c}
.bai-perm-hint{font-size:11px;color:#64748b;margin-top:10px;text-align:center}
@keyframes bai-perm-fadein{from{opacity:0}to{opacity:1}}
`
  document.head.appendChild(style)
}

function removeDialog(): void {
  _dialogEl?.remove()
  _dialogEl = null
}

/**
 * 显示确认对话框，返回用户选择
 */
export function showPermDialog(filePath: string, action: 'read' | 'write'): Promise<'once-allow' | 'once-deny' | 'always-allow' | 'always-deny'> {
  return new Promise(resolve => {
    injectPermCSS()
    removeDialog()

    const overlay = document.createElement('div')
    overlay.className = 'bai-perm-overlay'
    _dialogEl = overlay

    const icon = action === 'read' ? '📖' : '✏️'
    const actionText = action === 'read' ? 'read' : 'modify'

    overlay.innerHTML = `
<div class="bai-perm-box">
  <div class="bai-perm-title">${icon} Sensitive File Access</div>
  <div class="bai-perm-desc">AI wants to ${actionText} a sensitive file. This may contain secrets, credentials, or configuration.</div>
  <div class="bai-perm-file">${escapeHtml(filePath)}</div>
  <div class="bai-perm-btns">
    <button class="bai-perm-btn once" data-action="once-allow">✅ This time only</button>
    <button class="bai-perm-btn deny" data-action="once-deny">❌ Deny</button>
    <button class="bai-perm-btn always-allow" data-action="always-allow">✅ Always allow</button>
    <button class="bai-perm-btn always-deny" data-action="always-deny">❌ Always deny</button>
  </div>
  <div class="bai-perm-hint">"Always" choices are saved and won't ask again</div>
</div>`

    overlay.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null
      if (!btn) return
      const action = btn.dataset.action as 'once-allow' | 'once-deny' | 'always-allow' | 'always-deny'
      removeDialog()
      resolve(action)
    })

    document.body.appendChild(overlay)
  })
}

/**
 * 检查敏感文件权限（返回 true = 允许，false = 拒绝）
 * 如果文件不敏感，直接返回 true
 * 如果有已保存的决定，直接返回
 * 否则弹出对话框
 */
export async function checkFilePermission(filePath: string, action: 'read' | 'write'): Promise<boolean> {
  if (!isSensitiveFile(filePath)) return true

  const saved = getSavedDecision(filePath)
  if (saved === 'allow') return true
  if (saved === 'deny') return false

  const result = await showPermDialog(filePath, action)

  switch (result) {
    case 'once-allow': return true
    case 'once-deny': return false
    case 'always-allow':
      saveDecision(filePath, 'allow')
      return true
    case 'always-deny':
      saveDecision(filePath, 'deny')
      return false
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

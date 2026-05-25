/**
 * Browser AI Agent — 主入口
 *
 * 让 AI 网站拥有操作本地文件的能力，类似 opencode/claude code。
 *
 * 工作流：
 * 1. 页面右下角 🤖 → 打开面板 → 选择项目
 * 2. 面板显示项目上下文 → 用户在输入框输入需求 → 点击 Send to AI
 * 3. 系统将上下文(<system-reminder>) + 用户需求组合发送给 AI
 * 4. AI 知道能力 → Agent 监听对话 → 自动执行工具
 */
import { detectPlatform, getPlatformDisplayName } from './platforms/detector'
import { TriggerButton } from './ui/TriggerButton'
import { AgentPanel } from './ui/AgentPanel'
import { AgentLoop } from './agentLoop'
import type { FileEntry } from '../shared/types'
import { selectProjectFolder, readDirectoryStructure, readFile, writeFile, verifyPermission, countFiles } from './fileSystem'
import { saveHandle, saveProjectName } from './handleStore'
import { fillInput, appendToInput, simulateSend } from './injectUtils'
import { loadSettings, resolveLang, buildSystemPrompt, t, type Lang } from './settings'
import { registerExtensionHandler } from './extension-handler'

let dirHandle: FileSystemDirectoryHandle | null = null
let trigger: TriggerButton | null = null
let panel: AgentPanel | null = null
let agent: AgentLoop | null = null
let projectName = ''



function main(): void {
  const platform = detectPlatform()
  if (!platform) { console.log('[BAI] 不支持'); return }
  console.log(`[BAI] 检测到 ${getPlatformDisplayName(platform)}`)
  const tryInject = (n=8) => {
    if (document.body) { createTrigger(); return }
    if (n>0) setTimeout(()=>tryInject(n-1),1500)
  }
  setTimeout(()=>tryInject(),800)
}

function createTrigger(): void {
  trigger?.destroy()
  trigger = new TriggerButton(() => { trigger?.hide(); openPanel() })
}

async function openPanel(): Promise<void> {
  panel?.destroy()
  panel = new AgentPanel()

  // 如果项目仍在连接中，恢复面板状态
  if (dirHandle && projectName) {
    panel!.setProjectInfo(projectName, 0)
    panel!.setStatus('listening', '')
    panel!.addLog('info', `Project: ${projectName}`)
    const prompt = buildPrompt(projectName)
    panel!.showPrompt(prompt)
  }

  // 提示词复制到输入框
  panel!.onSendPrompt = (text: string) => {
    fillInput(text)
    setTimeout(() => {
      const sent = simulateSend()
      if (sent) {
        // 发送后关闭面板，agent 在后台继续运行
        panel?.destroy(); panel = null; trigger?.show()
      } else {
        panel!.addLog('warn', 'Could not auto-send, please press Enter')
      }
    }, 300)
  }

  panel!.onSelectProject = async () => {
    const r = await selectProjectFolder()
    if (!r) return null
    dirHandle = r.handle; projectName = r.name
    await saveHandle(r.handle); saveProjectName(r.name)
    const tree = await readDirectoryStructure(r.handle)
    afterProjectConnected()
    return { name: r.name, fileCount: countFiles(tree) }
  }

  panel!.onClose = () => { panel?.destroy(); panel=null; trigger?.show() }
}

function afterProjectConnected(): void {
  if (!dirHandle || !panel) return

  // 生成提示词
  const prompt = buildPrompt(projectName)
  panel.showPrompt(prompt)
  panel.addLog('success', `Project connected: ${projectName}`)
  panel.addLog('info', 'Type your request and click Send to AI')
  panel.setStatus('listening', '')

  startAgentLoop()
}

function countCurrentAIMessages(): number {
  let c = 0
  c += document.querySelectorAll('[data-message-author-role="assistant"]').length
  if (c === 0) c += document.querySelectorAll('.ds-assistant-message-main-content, [class*="assistant-message"]').length
  if (c === 0) c += document.querySelectorAll('ms-chat-turn').length
  return c
}

let _currentLang: Lang = 'en-US'
export function currentLang(): Lang { return _currentLang }

function buildPrompt(name: string): string {
  const s = loadSettings()
  _currentLang = resolveLang(s)
  return buildSystemPrompt(name, _currentLang)
}

function startAgentLoop(): void {
  if (!dirHandle || !panel) return
  agent?.stop()
  agent = new AgentLoop({
    lang: _currentLang,
    getConversation: async () => {
      const ms: Array<{role:string;content:string}> = []
      document.querySelectorAll('[data-message-author-role]').forEach(el => {
        const r = el.getAttribute('data-message-author-role')||''
        const c = el.textContent||''; if(c.trim()) ms.push({role:r,content:c})
      })
      if (ms.length===0) {
        document.querySelectorAll('[data-testid="user-message"]').forEach(el=>{const c=el.textContent||'';if(c.trim())ms.push({role:'user',content:c})})
        document.querySelectorAll('[data-testid="ai-message"]').forEach(el=>{const c=el.textContent||'';if(c.trim())ms.push({role:'assistant',content:c})})
      }
      if (ms.length===0) {
        document.querySelectorAll('ms-chat-turn').forEach(t=>{
          const u=t.querySelector('[class*="user"],[class*="user-turn"]');if(u?.textContent?.trim())ms.push({role:'user',content:u.textContent})
          const a=t.querySelector('[data-test-id="model-response"]');if(a?.textContent?.trim())ms.push({role:'assistant',content:a.textContent})
        })
      }
      // 策略 4: DeepSeek — 多步回退
      if (ms.length===0) {
        const skip = 'input,textarea,[contenteditable="true"],button,nav,header,footer,aside,script,style,svg,iframe,noscript,code,pre'
        const chatSel = ['.ds-markdown','[class*="chat-content"]','[class*="chat-main"]','[class*="message-list"]','[class*="conversation"]','main[role="main"]'].find(s=>document.querySelector(s))
        const candidates: Element[] = []

        // 4a: 聊天容器内找所有消息
        if (chatSel) {
          const container = document.querySelector(chatSel)!
          container.querySelectorAll('div,section,article').forEach(el=>{
            if (el.closest(skip)) return
            const c=el.textContent||'';if(c.length>10&&c.trim()) candidates.push(el)
          })
        }
        
        // 4b: 已知的选择器
        document.querySelectorAll('.ds-assistant-message-main-content,[class*="assistant-message"],[class*="ai-message"],[class*="response"],[class*="user-message"],[class*="question"],[class*="sender"]').forEach(el=>{
          if (el.closest(skip)) return
          const c=el.textContent||'';if(c.length>5&&c.trim()) candidates.push(el)
        })

        // 分类：找类名中的 role 关键词
        for (const el of candidates) {
          const c = el.textContent||''; if (!c.trim()||c.length<5) continue
          if (ms.some(m=>m.content===c)) continue
          const cls = (el.className||'')+(el.getAttribute('class')||'')
          const isAI = /assistant|ai-message|model|bot|response|markdown/i.test(cls)
          const isUser = /user-message|question|sender/i.test(cls)
          if (isAI || isUser) ms.push({ role: isAI?'assistant':'user', content: c })
          else if (candidates.length <= 5) ms.push({ role: 'assistant', content: c })
        }
      }
      return {messages:ms}
    },
    injectText: (t:string) => { appendToInput(t) },
    sendMessage: () => { simulateSend() },
    onLog: (type,msg) => panel?.addLog(type,msg),
    onToolResult: (r) => {
      panel?.addDiff(r.type, r.filePath, r.diff)
      renderDiffOnPage(r.type, r.filePath, r.diff)
    },
    onStatus: (text) => panel?.updateStatusBar(text),
  })
  agent.setDirectory(dirHandle)
  // 启动前跳过已有消息
  const existing = countCurrentAIMessages()
  agent.start(existing)
  // 调试：报告当前检测到的消息数
  setTimeout(() => {
    const ds = document.querySelectorAll('[data-message-author-role]').length
    const dsAssist = document.querySelectorAll('.ds-assistant-message-main-content, [class*="assistant-message"]').length
    panel?.addLog('info', `Msg detect: [author]=${ds}, ds-assist=${dsAssist}`)
  }, 2000)
}

// ============================================================
// Chrome Extension 消息处理器
// ============================================================

registerExtensionHandler({
  selectProject: async () => {
    const r = await selectProjectFolder()
    if (!r) return null
    dirHandle = r.handle
    projectName = r.name
    await saveHandle(r.handle)
    saveProjectName(r.name)
    const tree = await readDirectoryStructure(r.handle)
    afterProjectConnected()
    return { name: r.name, fileCount: countFiles(tree), tree }
  },

  getProjectInfo: async () => {
    if (!dirHandle) return { path: '', fileCount: 0 }
    const tree = await readDirectoryStructure(dirHandle)
    return { path: dirHandle.name, fileCount: countFiles(tree) }
  },

  executeCommand: async (cmd: string) => {
    if (!dirHandle) throw new Error('请先选择项目')
    if (!(await verifyPermission(dirHandle))) throw new Error('权限失效')

    const c = parseCmd(cmd)
    const log: Array<{ type: string; msg: string }> = []
    let tree: FileEntry[] | undefined

    switch (c.action) {
      case 'list':
        tree = await readDirectoryStructure(dirHandle)
        log.push({ type: 'success', msg: `已列出${countFiles(tree)}个文件` })
        break
      case 'read':
        if (!c.filePath) throw new Error('请指定路径')
        const ct = await readFile(dirHandle, c.filePath)
        writeToInput(ct)
        log.push({ type: 'info', msg: `读取${c.filePath}(${ct.length}字符)` })
        break
      case 'write':
        if (!c.filePath || c.content === undefined) throw new Error('请指定路径和内容')
        await writeFile(dirHandle, c.filePath, c.content)
        log.push({ type: 'success', msg: `已写入${c.filePath}` })
        break
      default:
        log.push({ type: 'warn', msg: '无法识别' })
    }

    return {
      log,
      tree,
      projectInfo: { name: dirHandle.name, fileCount: tree ? countFiles(tree) : 0 },
    }
  },
})

interface ParsedCmd {
  action: string
  filePath?: string
  content?: string
}

function parseCmd(input: string): ParsedCmd {
  const lower = input.toLowerCase().trim()
  if (lower === 'list' || lower === 'ls') return { action: 'list' }
  const rm = lower.match(/^(?:read|cat|查看|读取)\s+(\S.+)/)
  if (rm) return { action: 'read', filePath: rm[1].trim() }
  const wm = input.match(/^(?:write|写入|创建|修改)\s+(\S+)\s*[：:]\s*(.+)/s)
  if (wm) return { action: 'write', filePath: wm[1].trim(), content: wm[2].trim() }
  return { action: 'unknown' }
}

function writeToInput(text: string): void {
  const sels = [
    '#prompt-textarea',
    'div[contenteditable="true"]',
    'textarea#chat-input',
    '.chat-input-editor',
    'textarea',
  ]
  for (const sel of sels) {
    const el = document.querySelector<HTMLElement>(sel)
    if (!el) continue
    if (el.isContentEditable) {
      el.focus()
      document.execCommand('insertText', false, text)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      el.value = text
      el.dispatchEvent(new Event('input', { bubbles: true }))
      return
    }
  }
}

setTimeout(main,500)

// ============================================================
// 页面级 diff 渲染
// ============================================================

let _diffCssInjected = false

function injectDiffCSS(): void {
  if (_diffCssInjected) return
  _diffCssInjected = true
  const style = document.createElement('style')
  style.id = 'bai-diff-style'
  style.textContent = `
.bai-df{margin:8px 0;border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans SC',sans-serif}
.bai-df-hdr{display:flex;align-items:center;gap:6px;padding:5px 10px;font-size:12px;font-weight:600;color:#e2e8f0;background:#1e293b;border-bottom:1px solid #334155}
.bai-df-bd{margin:0;padding:6px 0;background:#0f172a;font-family:'SF Mono','Fira Code','Cascadia Code',monospace;font-size:12px;line-height:1.45;overflow-x:auto;white-space:pre;tab-size:2}
.bai-df-bd .da{color:#4ade80;background:rgba(74,222,128,.07);display:block;padding:0 10px}
.bai-df-bd .dd{color:#f87171;background:rgba(248,113,113,.07);display:block;padding:0 10px}
.bai-df-bd .dh{color:#c084fc;display:block;padding:0 10px}
.bai-df-bd .dc{color:#94a3b8;display:block;padding:0 10px}
`
  document.head.appendChild(style)
}

function renderDiffOnPage(type: 'edit' | 'write', filePath: string, diffText: string): void {
  injectDiffCSS()
  const msgEl = findLastAIMessage()
  if (!msgEl) return

  const icon = type === 'edit' ? '✏️' : '📝'
  const label = type === 'edit' ? 'Edited' : 'Created'

  const el = document.createElement('div')
  el.className = 'bai-df'
  el.innerHTML = `<div class="bai-df-hdr">${icon} <span>${escHtml(filePath)}</span> <span style="color:#94a3b8;font-weight:400">— ${label}</span></div><pre class="bai-df-bd">${diffToHtml(diffText)}</pre>`
  msgEl.appendChild(el)
}

function findLastAIMessage(): HTMLElement | null {
  const sels = [
    '[data-message-author-role="assistant"]',
    '[data-testid="ai-message"]',
    '.ds-assistant-message-main-content',
  ]
  for (const sel of sels) {
    const els = document.querySelectorAll<HTMLElement>(sel)
    if (els.length) return els[els.length - 1]
  }
  // fallback: class 包含 assistant-message
  const fallback = document.querySelectorAll<HTMLElement>('[class*="assistant-message"],[class*="ai-message"]')
  if (fallback.length) return fallback[fallback.length - 1]
  return null
}

function diffToHtml(diffText: string): string {
  return diffText.split('\n').map(line => {
    if (line.startsWith('+')) return `<span class="da">${escHtml(line)}</span>`
    if (line.startsWith('-')) return `<span class="dd">${escHtml(line)}</span>`
    if (line.startsWith('@@')) return `<span class="dh">${escHtml(line)}</span>`
    return `<span class="dc">${escHtml(line)}</span>`
  }).join('')
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
